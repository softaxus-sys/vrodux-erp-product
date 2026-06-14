using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PaymentVouchers.Commands;
using Softaxis.Finance.Application.PaymentVouchers.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal sealed class CreatePaymentVoucherHandler(FinanceDbContext db) : ICommandHandler<CreatePaymentVoucherCommand, PaymentVoucherDto>
{
    public async Task<Result<PaymentVoucherDto>> Handle(CreatePaymentVoucherCommand cmd, CancellationToken ct)
    {
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.SupplierId, ct);
        if (supplier is null)
            return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.SupplierNotFound", "The specified supplier does not exist."));

        if (cmd.BankAccountId is not null)
        {
            var bankAccountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.BankAccountId, ct);
            if (!bankAccountExists)
                return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.AccountNotFound", "The specified bank account does not exist."));
        }

        var allocatedTotal = cmd.Allocations.Sum(a => a.AmountApplied);
        if (allocatedTotal > cmd.Amount)
            return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.OverAllocated", "Allocated amount cannot exceed the payment amount."));

        var billIds = cmd.Allocations.Select(a => a.BillId).ToList();
        var bills = await db.PurchaseBills.Include(x => x.Items)
            .Where(x => billIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in cmd.Allocations)
        {
            var bill = bills.FirstOrDefault(x => x.Id == allocation.BillId);
            if (bill is null)
                return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.BillNotFound", "One or more bills could not be found."));

            if (bill.SupplierId != cmd.SupplierId)
                return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.BillSupplierMismatch", $"Bill {bill.BillNumber} does not belong to the selected supplier."));

            if (bill.Status is not ("approved" or "partially_paid"))
                return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.BillNotPayable", $"Bill {bill.BillNumber} is not in a payable state."));

            if (allocation.AmountApplied > bill.AmountDue)
                return Result.Failure<PaymentVoucherDto>(Error.Custom("PaymentVoucher.OverAllocated", $"Allocated amount for bill {bill.BillNumber} exceeds its outstanding balance."));
        }

        var voucher = new PaymentVoucher(cmd.SupplierId, supplier.Name, cmd.PaymentDate, cmd.Amount,
            cmd.PaymentMethod, cmd.BankAccountId, cmd.Reference, cmd.Notes);

        foreach (var allocation in cmd.Allocations)
            voucher.Allocations.Add(new PaymentAllocation(voucher.Id, allocation.BillId, allocation.AmountApplied));

        db.PaymentVouchers.Add(voucher);
        await db.SaveChangesAsync(ct);

        var billsById = bills.ToDictionary(x => x.Id);
        return Result.Success(PaymentVoucherMappings.ToDto(voucher, billsById));
    }
}
