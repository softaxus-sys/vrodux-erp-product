using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class DeleteLeaveHandler(HrDbContext db)
    : ICommandHandler<DeleteLeaveCommand>
{
    public async Task<Result> Handle(DeleteLeaveCommand cmd, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([cmd.Id], ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.Id));

        leave.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
