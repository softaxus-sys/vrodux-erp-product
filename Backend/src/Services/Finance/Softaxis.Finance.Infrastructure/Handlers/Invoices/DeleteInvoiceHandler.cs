using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class DeleteInvoiceHandler(FinanceDbContext db) : ICommandHandler<DeleteInvoiceCommand>
{
    public async Task<Result> Handle(DeleteInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([cmd.Id], ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        invoice.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
