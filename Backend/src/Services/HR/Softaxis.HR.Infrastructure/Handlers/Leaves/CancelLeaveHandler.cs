using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class CancelLeaveHandler(HrDbContext db)
    : ICommandHandler<CancelLeaveCommand>
{
    public async Task<Result> Handle(CancelLeaveCommand cmd, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([cmd.Id], ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.Id));

        if (leave.Status == "cancelled")
            return Result.Failure(Error.Custom("Leave.Conflict", "Leave is already cancelled."));

        leave.Cancel();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
