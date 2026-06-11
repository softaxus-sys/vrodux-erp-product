using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class ApproveLeaveHandler(HrDbContext db)
    : ICommandHandler<ApproveLeaveCommand>
{
    public async Task<Result> Handle(ApproveLeaveCommand cmd, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([cmd.Id], ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.Id));

        if (leave.Status != "pending")
            return Result.Failure(Error.Custom("Leave.Conflict", "Only pending leaves can be approved."));

        leave.Approve(cmd.ApproverId, cmd.Notes);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
