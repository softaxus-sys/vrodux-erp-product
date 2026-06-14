using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class CreateRecurringInvoiceHandler(FinanceDbContext db) : ICommandHandler<CreateRecurringInvoiceCommand, RecurringDto>
{
    public async Task<Result<RecurringDto>> Handle(CreateRecurringInvoiceCommand cmd, CancellationToken ct)
    {
        var r = new RecurringInvoice(cmd.TemplateName, cmd.CustomerName, cmd.CustomerEmail,
            cmd.Frequency, RecurringInvoiceMappings.ParseDate(cmd.StartDate), RecurringInvoiceMappings.ParseNullableDate(cmd.EndDate),
            cmd.DueDays, cmd.TaxRate, cmd.Notes);

        foreach (var l in cmd.Lines)
            r.Lines.Add(new RecurringInvoiceLine(r.Id, l.Description, l.Quantity, l.UnitPrice));

        db.RecurringInvoices.Add(r);
        await db.SaveChangesAsync(ct);

        return Result.Success(RecurringInvoiceMappings.ToDto(r));
    }
}
