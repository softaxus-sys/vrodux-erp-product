using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class SendInvoiceHandler(FinanceDbContext db) : ICommandHandler<SendInvoiceCommand>
{
    public async Task<Result> Handle(SendInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([cmd.Id], ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status != "draft")
            return Result.Failure(Error.Custom("Invoice.Conflict", "Only draft invoices can be sent."));

        invoice.Send();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
