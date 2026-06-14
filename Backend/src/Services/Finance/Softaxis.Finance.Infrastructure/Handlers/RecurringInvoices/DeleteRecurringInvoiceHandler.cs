using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class DeleteRecurringInvoiceHandler(FinanceDbContext db) : ICommandHandler<DeleteRecurringInvoiceCommand>
{
    public async Task<Result> Handle(DeleteRecurringInvoiceCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.FindAsync([cmd.Id], ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringInvoice", cmd.Id));

        r.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
