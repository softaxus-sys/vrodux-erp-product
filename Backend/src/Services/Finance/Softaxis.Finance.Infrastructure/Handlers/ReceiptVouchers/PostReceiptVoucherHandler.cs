using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class PostReceiptVoucherHandler(FinanceDbContext db) : ICommandHandler<PostReceiptVoucherCommand>
{
    public async Task<Result> Handle(PostReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(ReceiptVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("ReceiptVoucher.Conflict", "Only draft receipt vouchers can be posted."));

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
        var lines = new List<GlPoster.Line>
        {
            new(cashAccount, voucher.Amount, 0, $"Receipt {voucher.VoucherNumber} - {voucher.CustomerName}"),
            new(GlPoster.AccountsReceivable, 0, voucher.Amount, $"AR - Receipt {voucher.VoucherNumber}"),
        };

        var journalEntryId = await GlPoster.PostAsync(db, voucher.ReceiptDate, $"Receipt Voucher {voucher.VoucherNumber}", voucher.VoucherNumber, lines, ct);
        voucher.SetJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
