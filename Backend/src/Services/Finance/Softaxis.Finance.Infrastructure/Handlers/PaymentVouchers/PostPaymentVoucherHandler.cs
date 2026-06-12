using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
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
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
