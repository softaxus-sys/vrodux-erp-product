using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class VoidPaymentVoucherHandler(FinanceDbContext db) : ICommandHandler<VoidPaymentVoucherCommand>
{
    public async Task<Result> Handle(VoidPaymentVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.PaymentVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(PaymentVoucher), cmd.Id));

        if (voucher.Status == "void")
            return Result.Failure(Error.Custom("PaymentVoucher.Conflict", "Payment voucher is already void."));

        if (voucher.Status == "posted")
        {
            var billIds = voucher.Allocations.Select(a => a.BillId).ToList();
            var bills = await db.PurchaseBills.Where(x => billIds.Contains(x.Id)).ToListAsync(ct);

            foreach (var allocation in voucher.Allocations)
            {
                var bill = bills.FirstOrDefault(x => x.Id == allocation.BillId);
                bill?.ReversePayment(allocation.AmountApplied);
            }

            await GlPoster.VoidAsync(db, voucher.JournalEntryId, ct);
            voucher.SetJournalEntryId(null);
        }

        voucher.Void();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
