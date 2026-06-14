using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class ResumeRecurringInvoiceHandler(FinanceDbContext db) : ICommandHandler<ResumeRecurringInvoiceCommand>
{
    public async Task<Result> Handle(ResumeRecurringInvoiceCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.FindAsync([cmd.Id], ct);
        if (r is null)
            return Result.Failure(Error.NotFoundById("RecurringInvoice", cmd.Id));

        r.Resume();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
