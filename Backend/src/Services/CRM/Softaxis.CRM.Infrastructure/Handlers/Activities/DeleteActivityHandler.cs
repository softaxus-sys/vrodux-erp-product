using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

/// <summary>
/// Activities are an append-only record and are never deleted — a task, call, meeting, note or
/// logged email is what the next person reads and what the reports count, so it is not the
/// author's to retract. Finish a task instead of removing it; edit a note to correct it.
/// <para>
/// The endpoint is kept so any older client calling it gets a clear 409 rather than a silent
/// success. The web UI no longer offers a delete control at all.
/// </para>
/// </summary>
internal sealed class DeleteActivityHandler(CrmDbContext db) : ICommandHandler<DeleteActivityCommand>
{
    public async Task<Result> Handle(DeleteActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        return Result.Failure(Error.Custom(
            "Activity.Conflict",
            "Logged activities are part of the record and cannot be deleted."));
    }
}
