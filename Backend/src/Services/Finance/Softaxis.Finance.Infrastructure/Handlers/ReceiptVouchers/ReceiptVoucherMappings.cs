using Softaxis.Finance.Application.ReceiptVouchers.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.ReceiptVouchers;

internal static class ReceiptVoucherMappings
{
    public static ReceiptVoucherDto ToDto(ReceiptVoucher x, IReadOnlyDictionary<Guid, Invoice> invoicesById) => new(
        x.Id, x.VoucherNumber, x.CustomerId, x.CustomerName,
        x.ReceiptDate, x.Amount, x.ReceiptMethod, x.BankAccountId, x.Reference, x.Notes,
        x.Status,
        x.Allocations.Select(a =>
        {
            invoicesById.TryGetValue(a.InvoiceId, out var invoice);
            return new ReceiptAllocationDto(a.Id, a.InvoiceId, invoice?.InvoiceNumber ?? string.Empty, invoice?.Total ?? 0, a.AmountApplied);
        }).ToList(),
        x.PostedAt, x.CreatedAt, x.UpdatedAt);
}
