using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class CreateInvoiceHandler(FinanceDbContext db) : ICommandHandler<CreateInvoiceCommand, InvoiceDto>
{
    public async Task<Result<InvoiceDto>> Handle(CreateInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = new Invoice(cmd.CustomerName, cmd.CustomerEmail,
            cmd.InvoiceDate, cmd.DueDate, cmd.TaxRate, cmd.Notes);

        foreach (var item in cmd.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice));

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);

        return Result.Success(InvoiceMappings.ToDto(invoice));
    }
}
