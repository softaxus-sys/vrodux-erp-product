using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class UpdatePerformanceGoalHandler(HrDbContext db)
    : ICommandHandler<UpdatePerformanceGoalCommand>
{
    public async Task<Result> Handle(UpdatePerformanceGoalCommand cmd, CancellationToken ct)
    {
        var goal = await db.PerformanceGoals.FirstOrDefaultAsync(x => x.Id == cmd.GoalId && x.PerformanceReviewId == cmd.ReviewId, ct);
        if (goal is null)
            return Result.Failure(Error.NotFoundById("PerformanceGoal", cmd.GoalId));

        goal.UpdateProgress(cmd.Progress, cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
