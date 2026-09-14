using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal sealed class RetryLeadInboxEntryHandler(CrmDbContext db)
    : ICommandHandler<RetryLeadInboxEntryCommand>
{
    public async Task<Result> Handle(RetryLeadInboxEntryCommand cmd, CancellationToken ct)
    {
        var row = await db.RawLeadInbox.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (row is null) return Result.Failure(Error.NotFoundById("LeadInbox", cmd.Id));

        // Only a row the processor has given up on. Re-queueing one that already produced a lead
        // would create a second copy of it, and one mid-flight would be processed twice.
        if (row.Status != RawLeadStatus.Failed)
            return Result.Failure(Error.Custom("LeadInbox.Conflict",
                $"Only failed deliveries can be retried — this one is '{row.Status}'."));

        row.Requeue();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
