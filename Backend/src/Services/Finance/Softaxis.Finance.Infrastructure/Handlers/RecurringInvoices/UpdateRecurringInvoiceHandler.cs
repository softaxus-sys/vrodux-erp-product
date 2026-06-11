using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class UpdateRecurringInvoiceHandler(FinanceDbContext db) : ICommandHandler<UpdateRecurringInvoiceCommand>
{
    public async Task<Result> Handle(UpdateRecurringInvoiceCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringInvoice", cmd.Id));

        r.Update(cmd.TemplateName, cmd.CustomerName, cmd.CustomerEmail, cmd.Frequency,
            RecurringInvoiceMappings.ParseNullableDate(cmd.EndDate), cmd.DueDays, cmd.TaxRate, cmd.Notes);

        db.RecurringInvoiceLines.RemoveRange(r.Lines);
        r.Lines.Clear();
        foreach (var l in cmd.Lines)
            r.Lines.Add(new RecurringInvoiceLine(r.Id, l.Description, l.Quantity, l.UnitPrice));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
