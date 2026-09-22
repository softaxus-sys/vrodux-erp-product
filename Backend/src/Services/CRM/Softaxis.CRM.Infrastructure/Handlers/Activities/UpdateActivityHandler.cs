using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

/// <summary>
/// Activities are an append-only record: once logged, a task, call, meeting, note or email can be
/// completed or reopened, but its content is never edited and it is never deleted. What was written
/// at the time is what the next person reads and what the reports count, so it is not the author's
/// to rewrite. A correction is logged as a new entry, which keeps both the original and the fix.
/// <para>
/// The endpoint is kept so any older client calling it gets a clear 409 rather than a silent
/// success. The web UI offers no edit control at all. See also DeleteActivityHandler.
/// </para>
/// </summary>
internal sealed class UpdateActivityHandler(CrmDbContext db) : ICommandHandler<UpdateActivityCommand>
{
    public async Task<Result> Handle(UpdateActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        return Result.Failure(Error.Custom(
            "Activity.Conflict",
            "Logged activities are part of the record and cannot be edited. Log a new entry instead."));
    }
}
