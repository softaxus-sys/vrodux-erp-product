using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class PauseRecurringInvoiceHandler(FinanceDbContext db) : ICommandHandler<PauseRecurringInvoiceCommand>
{
    public async Task<Result> Handle(PauseRecurringInvoiceCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.FindAsync([cmd.Id], ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringInvoice", cmd.Id));

        r.Pause();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
