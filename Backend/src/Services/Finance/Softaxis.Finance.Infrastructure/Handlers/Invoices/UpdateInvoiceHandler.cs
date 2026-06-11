using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class UpdateInvoiceHandler(FinanceDbContext db) : ICommandHandler<UpdateInvoiceCommand>
{
    public async Task<Result> Handle(UpdateInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        invoice.Update(cmd.CustomerName, cmd.CustomerEmail, cmd.InvoiceDate, cmd.DueDate,
            cmd.TaxRate, cmd.Notes, cmd.Status);

        db.InvoiceItems.RemoveRange(invoice.Items);
        invoice.Items.Clear();
        foreach (var item in cmd.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
