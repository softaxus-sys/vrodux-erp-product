using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;
using Softaxis.Finance.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class PostReceiptVoucherHandler(
    FinanceDbContext db,
    IFinanceEmailService email,
    ILogger<PostReceiptVoucherHandler> logger) : ICommandHandler<PostReceiptVoucherCommand>
{
    public async Task<Result> Handle(PostReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(ReceiptVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("ReceiptVoucher.Conflict", "Only draft receipt vouchers can be posted."));

        if (await GlPoster.IsPeriodClosedAsync(db, voucher.ReceiptDate, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {voucher.ReceiptDate} is closed for posting."));

        var invoiceIds = voucher.Allocations.Select(a => a.InvoiceId).ToList();
        var invoices = await db.Invoices.Include(x => x.Items).Where(x => invoiceIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in voucher.Allocations)
        {
            var invoice = invoices.First(x => x.Id == allocation.InvoiceId);
            if (allocation.AmountApplied > invoice.AmountDue)
                return Result.Failure(Error.Custom("ReceiptVoucher.OverAllocated", $"Allocated amount for invoice {invoice.InvoiceNumber} exceeds its outstanding balance."));
        }

        foreach (var allocation in voucher.Allocations)
        {
            var invoice = invoices.First(x => x.Id == allocation.InvoiceId);
            invoice.RecordPayment(allocation.AmountApplied);
        }

        voucher.Post();

        var cashAccount = GlPoster.ResolveCashAccount(voucher.ReceiptMethod);
        var settlementRate = await GlPoster.GetRateAsync(db, voucher.CurrencyCode, voucher.ReceiptDate, ct);
        var cashAed = voucher.Amount * settlementRate;

        var arAed = 0m;
        foreach (var allocation in voucher.Allocations)
        {
            var invoice = invoices.First(x => x.Id == allocation.InvoiceId);
            var invoiceRate = await GlPoster.GetRateAsync(db, invoice.CurrencyCode, invoice.InvoiceDate, ct);
            arAed += allocation.AmountApplied * invoiceRate;
        }

        var lines = new List<GlPoster.Line>
        {
            new(cashAccount, cashAed, 0, $"Receipt {voucher.VoucherNumber} - {voucher.CustomerName}"),
            new(GlPoster.AccountsReceivable, 0, arAed, $"AR - Receipt {voucher.VoucherNumber}"),
        };

        // Realized FX gain/loss: cash received (at settlement rate) vs. AR relieved (at invoice rate).
        var fx = cashAed - arAed;
        if (fx > 0)
            lines.Add(new(GlPoster.FxGainLoss, 0, fx, $"FX Gain - Receipt {voucher.VoucherNumber}"));
        else if (fx < 0)
            lines.Add(new(GlPoster.FxGainLoss, -fx, 0, $"FX Loss - Receipt {voucher.VoucherNumber}"));

        var journalEntryId = await GlPoster.PostAsync(db, voucher.ReceiptDate, $"Receipt Voucher {voucher.VoucherNumber}", voucher.VoucherNumber, lines, ct);
        voucher.SetJournalEntryId(journalEntryId);

        // Captured BEFORE the send: RecordPayment already ran above, so AmountDue is the balance
        // left AFTER this receipt — which is exactly what the customer needs to see.
        var applied = voucher.Allocations
            .Select(a =>
            {
                var invoice = invoices.First(x => x.Id == a.InvoiceId);
                return new VoucherReceiptEmailTemplate.AppliedLine(
                    invoice.InvoiceNumber, a.AmountApplied, invoice.AmountDue);
            })
            .ToList();

        await db.SaveChangesAsync(ct);

        await SendReceiptAsync(voucher, applied, ct);

        return Result.Success();
    }

    /// <summary>
    /// Emails the customer their receipt, copying the workspace CC list.
    ///
    /// Best-effort and after the commit: the money is recorded and the ledger posted either way. A
    /// mail server being down must never fail a payment that has already happened, and re-sending
    /// a receipt is trivial where un-posting a voucher is not.
    /// </summary>
    private async Task SendReceiptAsync(
        ReceiptVoucher voucher,
        IReadOnlyList<VoucherReceiptEmailTemplate.AppliedLine> applied,
        CancellationToken ct)
    {
        try
        {
            // The voucher stores no email of its own. Prefer the customer record; fall back to an
            // address on one of the invoices it settled, which is where the bill was sent.
            var toEmail = await db.Customers.AsNoTracking()
                .Where(c => c.Id == voucher.CustomerId)
                .Select(c => c.Email)
                .FirstOrDefaultAsync(ct);

            if (string.IsNullOrWhiteSpace(toEmail))
            {
                var invoiceIds = voucher.Allocations.Select(a => a.InvoiceId).ToList();
                toEmail = await db.Invoices.AsNoTracking()
                    .Where(i => invoiceIds.Contains(i.Id) && i.CustomerEmail != null)
                    .Select(i => i.CustomerEmail)
                    .FirstOrDefaultAsync(ct);
            }

            if (string.IsNullOrWhiteSpace(toEmail))
            {
                logger.LogWarning(
                    "Receipt voucher {VoucherNumber} posted, but no email address is on file for {Customer}.",
                    voucher.VoucherNumber, voucher.CustomerName);
                return;
            }

            var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);
            var body = VoucherReceiptEmailTemplate.Build(voucher, branding, applied);

            var sent = await email.SendInvoiceAsync(
                toEmail!, voucher.CustomerName, branding.CcList,
                body.Subject, body.Html, body.InlineImages, ct);

            // Recorded only on a real send, so a voucher never claims a receipt nobody received.
            if (sent)
            {
                voucher.RecordReceiptSent(toEmail!);
                await db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Receipt voucher {VoucherNumber} posted, but the receipt email failed.",
                voucher.VoucherNumber);
        }
    }
}
