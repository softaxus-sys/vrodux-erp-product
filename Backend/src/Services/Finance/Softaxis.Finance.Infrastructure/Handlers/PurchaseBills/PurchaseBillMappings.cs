using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal static class PurchaseBillMappings
{
    public static PurchaseBillDto ToDto(PurchaseBill x) => new(
        x.Id, x.BillNumber, x.SupplierId, x.SupplierName,
        x.BillDate, x.DueDate, x.TaxRate, x.SubTotal, x.TaxAmount, x.Total,
        x.AmountPaid, x.AmountDue, x.Status, x.Reference, x.Notes,
        x.Items.Select(i => new PurchaseBillItemDto(i.Id, i.Description, i.Quantity, i.UnitPrice, i.LineTotal)).ToList(),
        x.CreatedAt, x.UpdatedAt);
}
