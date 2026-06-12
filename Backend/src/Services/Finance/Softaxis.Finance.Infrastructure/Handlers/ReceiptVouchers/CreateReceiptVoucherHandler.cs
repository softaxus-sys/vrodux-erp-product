using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ReceiptVouchers.Commands;
using Softaxis.Finance.Application.ReceiptVouchers.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal sealed class CreateReceiptVoucherHandler(FinanceDbContext db) : ICommandHandler<CreateReceiptVoucherCommand, ReceiptVoucherDto>
{
    public async Task<Result<ReceiptVoucherDto>> Handle(CreateReceiptVoucherCommand cmd, CancellationToken ct)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.CustomerId, ct);
        if (customer is null)
            return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.CustomerNotFound", "The specified customer does not exist."));

        if (cmd.BankAccountId is not null)
        {
            var bankAccountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.BankAccountId, ct);
            if (!bankAccountExists)
                return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.AccountNotFound", "The specified bank account does not exist."));
        }

        var allocatedTotal = cmd.Allocations.Sum(a => a.AmountApplied);
        if (allocatedTotal > cmd.Amount)
            return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.OverAllocated", "Allocated amount cannot exceed the receipt amount."));

        var invoiceIds = cmd.Allocations.Select(a => a.InvoiceId).ToList();
        var invoices = await db.Invoices.Include(x => x.Items)
            .Where(x => invoiceIds.Contains(x.Id)).ToListAsync(ct);

        foreach (var allocation in cmd.Allocations)
        {
            var invoice = invoices.FirstOrDefault(x => x.Id == allocation.InvoiceId);
            if (invoice is null)
                return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.InvoiceNotFound", "One or more invoices could not be found."));

            if (invoice.CustomerId != cmd.CustomerId)
                return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.InvoiceCustomerMismatch", $"Invoice {invoice.InvoiceNumber} does not belong to the selected customer."));

            if (invoice.Status is not ("sent" or "partially_paid" or "overdue"))
                return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.InvoiceNotReceivable", $"Invoice {invoice.InvoiceNumber} is not in a receivable state."));

            if (allocation.AmountApplied > invoice.AmountDue)
                return Result.Failure<ReceiptVoucherDto>(Error.Custom("ReceiptVoucher.OverAllocated", $"Allocated amount for invoice {invoice.InvoiceNumber} exceeds its outstanding balance."));
        }

        var voucher = new ReceiptVoucher(cmd.CustomerId, customer.Name, cmd.ReceiptDate, cmd.Amount,
            cmd.ReceiptMethod, cmd.BankAccountId, cmd.Reference, cmd.Notes);

        foreach (var allocation in cmd.Allocations)
            voucher.Allocations.Add(new ReceiptAllocation(voucher.Id, allocation.InvoiceId, allocation.AmountApplied));

        db.ReceiptVouchers.Add(voucher);
        await db.SaveChangesAsync(ct);

        var invoicesById = invoices.ToDictionary(x => x.Id);
        return Result.Success(ReceiptVoucherMappings.ToDto(voucher, invoicesById));
    }
}
