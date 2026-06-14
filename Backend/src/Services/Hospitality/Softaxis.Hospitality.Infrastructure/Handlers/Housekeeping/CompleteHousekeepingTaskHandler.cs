using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Commands;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class CompleteHousekeepingTaskHandler(HospitalityDbContext db) : ICommandHandler<CompleteHousekeepingTaskCommand, HousekeepingTaskStatusDto>
{
    public async Task<Result<HousekeepingTaskStatusDto>> Handle(CompleteHousekeepingTaskCommand command, CancellationToken ct)
    {
        var task = await db.HousekeepingTasks.FindAsync([command.Id], ct);
        if (task is null)
        {
            return Result.Failure<HousekeepingTaskStatusDto>(Error.NotFoundById("HousekeepingTask", command.Id));
        }

        task.Complete();
        await db.SaveChangesAsync(ct);

        return Result.Success(new HousekeepingTaskStatusDto(task.Id, task.Status));
    }
}
