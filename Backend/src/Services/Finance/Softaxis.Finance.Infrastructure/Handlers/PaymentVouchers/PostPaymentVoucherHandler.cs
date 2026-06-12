using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class PostPaymentVoucherHandler(FinanceDbContext db) : ICommandHandler<PostPaymentVoucherCommand>
{
    public async Task<Result> Handle(PostPaymentVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.PaymentVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(PaymentVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("PaymentVoucher.Conflict", "Only draft payment vouchers can be posted."));

        if (await GlPoster.IsPeriodClosedAsync(db, voucher.PaymentDate, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {voucher.PaymentDate} is closed for posting."));

        var billIds = voucher.Allocations.Select(a => a.BillId).ToList();
        var bills = await db.PurchaseBills.Where(x => billIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in voucher.Allocations)
        {
            var bill = bills.First(x => x.Id == allocation.BillId);
            if (allocation.AmountApplied > bill.AmountDue)
                return Result.Failure(Error.Custom("PaymentVoucher.OverAllocated", $"Allocated amount for bill {bill.BillNumber} exceeds its outstanding balance."));
        }

        foreach (var allocation in voucher.Allocations)
        {
            var bill = bills.First(x => x.Id == allocation.BillId);
            bill.RecordPayment(allocation.AmountApplied);
        }

        voucher.Post();

        var cashAccount = GlPoster.ResolveCashAccount(voucher.PaymentMethod);
        var settlementRate = await GlPoster.GetRateAsync(db, voucher.CurrencyCode, voucher.PaymentDate, ct);
        var cashAed = voucher.Amount * settlementRate;

        var apAed = 0m;
        foreach (var allocation in voucher.Allocations)
        {
            var bill = bills.First(x => x.Id == allocation.BillId);
            var billRate = await GlPoster.GetRateAsync(db, bill.CurrencyCode, bill.BillDate, ct);
            apAed += allocation.AmountApplied * billRate;
        }

        var lines = new List<GlPoster.Line>
        {
            new(GlPoster.AccountsPayable, apAed, 0, $"AP - Payment {voucher.VoucherNumber}"),
            new(cashAccount, 0, cashAed, $"Payment {voucher.VoucherNumber} - {voucher.SupplierName}"),
        };

        // Realized FX gain/loss: AP relieved (at bill rate) vs. cash paid (at settlement rate).
        var fx = apAed - cashAed;
        if (fx > 0)
            lines.Add(new(GlPoster.FxGainLoss, 0, fx, $"FX Gain - Payment {voucher.VoucherNumber}"));
        else if (fx < 0)
            lines.Add(new(GlPoster.FxGainLoss, -fx, 0, $"FX Loss - Payment {voucher.VoucherNumber}"));

        var journalEntryId = await GlPoster.PostAsync(db, voucher.PaymentDate, $"Payment Voucher {voucher.VoucherNumber}", voucher.VoucherNumber, lines, ct);
        voucher.SetJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
