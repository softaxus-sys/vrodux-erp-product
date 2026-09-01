using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal static class InvoiceMappings
{
    public static InvoiceDto ToDto(Invoice x) => new(
        x.Id, x.InvoiceNumber, x.CustomerName, x.CustomerEmail,
        x.InvoiceDate, x.DueDate, x.TaxRate, x.SubTotal, x.TaxAmount, x.Total,
        x.Status, x.Notes, x.CcEmails,
        x.Items.Select(i => new InvoiceItemDto(i.Id, i.Description, i.Quantity, i.UnitPrice, i.LineTotal)).ToList(),
        x.PaidAt, x.CreatedAt, x.UpdatedAt);
}
