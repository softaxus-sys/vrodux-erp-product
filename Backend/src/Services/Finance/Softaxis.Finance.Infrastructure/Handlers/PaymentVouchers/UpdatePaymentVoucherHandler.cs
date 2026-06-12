using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class UpdatePaymentVoucherHandler(FinanceDbContext db) : ICommandHandler<UpdatePaymentVoucherCommand>
{
    public async Task<Result> Handle(UpdatePaymentVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.PaymentVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(PaymentVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("PaymentVoucher.Conflict", "Only draft payment vouchers can be edited."));

        var allocatedTotal = cmd.Allocations.Sum(a => a.AmountApplied);
        if (allocatedTotal > cmd.Amount)
            return Result.Failure(Error.Custom("PaymentVoucher.OverAllocated", "Allocated amount cannot exceed the payment amount."));

        var billIds = cmd.Allocations.Select(a => a.BillId).ToList();
        var bills = await db.PurchaseBills.Where(x => billIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in cmd.Allocations)
        {
            var bill = bills.FirstOrDefault(x => x.Id == allocation.BillId);
            if (bill is null)
                return Result.Failure(Error.Custom("PaymentVoucher.BillNotFound", "One or more bills could not be found."));

            if (bill.SupplierId != voucher.SupplierId)
                return Result.Failure(Error.Custom("PaymentVoucher.BillSupplierMismatch", $"Bill {bill.BillNumber} does not belong to the selected supplier."));

            if (allocation.AmountApplied > bill.AmountDue)
                return Result.Failure(Error.Custom("PaymentVoucher.OverAllocated", $"Allocated amount for bill {bill.BillNumber} exceeds its outstanding balance."));
        }

        voucher.Update(voucher.SupplierName, cmd.PaymentDate, cmd.Amount, cmd.PaymentMethod,
            cmd.BankAccountId, cmd.Reference, cmd.Notes);

        db.PaymentAllocations.RemoveRange(voucher.Allocations);
        voucher.ReplaceAllocations(cmd.Allocations.Select(a => new PaymentAllocation(voucher.Id, a.BillId, a.AmountApplied)));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
