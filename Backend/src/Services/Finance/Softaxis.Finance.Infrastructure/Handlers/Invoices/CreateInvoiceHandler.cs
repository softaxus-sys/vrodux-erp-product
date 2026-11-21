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
            cmd.InvoiceDate, cmd.DueDate, cmd.TaxRate, cmd.Notes, cmd.CcEmails);

        invoice.SetCustomerTaxDetails(cmd.CustomerAddress, cmd.CustomerTrn);
        invoice.SetPaymentDetails(cmd.PaymentMethod, cmd.PaymentLink, cmd.PaymentInstructions, cmd.PaymentAccountNumber);
        invoice.SetScheduledSend(cmd.ScheduledSendDate);
        invoice.SetRemindBeforeDue(cmd.RemindBeforeDue);

        // Null = the workspace's default rules (none if it has not set any up); a list, even an
        // empty one, is the caller's explicit choice for this invoice.
        invoice.SetSetAsides(cmd.SetAsides is null
            ? await Softaxis.Finance.Infrastructure.Services.SetAsideService.DefaultsAsync(db, ct)
            : cmd.SetAsides.Select(s => new SetAsideDef(s.Name, s.Kind, s.Value)));

        foreach (var item in cmd.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice, item.TaxCategory, item.UnitCode, item.ExemptionReason));

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);

        return Result.Success(InvoiceMappings.ToDto(invoice));
    }
}
