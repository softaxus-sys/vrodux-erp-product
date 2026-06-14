using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class UpdateReceiptVoucherHandler(FinanceDbContext db) : ICommandHandler<UpdateReceiptVoucherCommand>
{
    public async Task<Result> Handle(UpdateReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var voucher = await db.ReceiptVouchers.Include(x => x.Allocations)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (voucher is null)
            return Result.Failure(Error.NotFoundById(nameof(ReceiptVoucher), cmd.Id));

        if (voucher.Status != "draft")
            return Result.Failure(Error.Custom("ReceiptVoucher.Conflict", "Only draft receipt vouchers can be edited."));

        var allocatedTotal = cmd.Allocations.Sum(a => a.AmountApplied);
        if (allocatedTotal > cmd.Amount)
            return Result.Failure(Error.Custom("ReceiptVoucher.OverAllocated", "Allocated amount cannot exceed the receipt amount."));

        var invoiceIds = cmd.Allocations.Select(a => a.InvoiceId).ToList();
        var invoices = await db.Invoices.Include(x => x.Items).Where(x => invoiceIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in cmd.Allocations)
        {
            var invoice = invoices.FirstOrDefault(x => x.Id == allocation.InvoiceId);
            if (invoice is null)
                return Result.Failure(Error.Custom("ReceiptVoucher.InvoiceNotFound", "One or more invoices could not be found."));

            if (invoice.CustomerId != voucher.CustomerId)
                return Result.Failure(Error.Custom("ReceiptVoucher.InvoiceCustomerMismatch", $"Invoice {invoice.InvoiceNumber} does not belong to the selected customer."));

            if (allocation.AmountApplied > invoice.AmountDue)
                return Result.Failure(Error.Custom("ReceiptVoucher.OverAllocated", $"Allocated amount for invoice {invoice.InvoiceNumber} exceeds its outstanding balance."));
        }

        voucher.Update(voucher.CustomerName, cmd.ReceiptDate, cmd.Amount, cmd.ReceiptMethod,
            cmd.BankAccountId, cmd.Reference, cmd.Notes);

        db.ReceiptAllocations.RemoveRange(voucher.Allocations);
        voucher.ReplaceAllocations(cmd.Allocations.Select(a => new ReceiptAllocation(voucher.Id, a.InvoiceId, a.AmountApplied)));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
