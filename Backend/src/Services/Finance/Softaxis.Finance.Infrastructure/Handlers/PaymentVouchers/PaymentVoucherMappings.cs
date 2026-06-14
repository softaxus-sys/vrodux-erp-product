using Softaxis.Finance.Application.PaymentVouchers.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.PaymentVouchers;

internal static class PaymentVoucherMappings
{
    public static PaymentVoucherDto ToDto(PaymentVoucher x, IReadOnlyDictionary<Guid, PurchaseBill> billsById) => new(
        x.Id, x.VoucherNumber, x.SupplierId, x.SupplierName,
        x.PaymentDate, x.Amount, x.PaymentMethod, x.BankAccountId, x.Reference, x.Notes,
        x.Status,
        x.Allocations.Select(a =>
        {
            billsById.TryGetValue(a.BillId, out var bill);
            return new PaymentAllocationDto(a.Id, a.BillId, bill?.BillNumber ?? string.Empty, bill?.Total ?? 0, a.AmountApplied);
        }).ToList(),
        x.PostedAt, x.CreatedAt, x.UpdatedAt);
}
