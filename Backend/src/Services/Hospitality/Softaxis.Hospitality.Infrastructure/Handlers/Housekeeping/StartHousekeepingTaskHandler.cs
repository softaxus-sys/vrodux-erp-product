using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Commands;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class StartHousekeepingTaskHandler(HospitalityDbContext db) : ICommandHandler<StartHousekeepingTaskCommand, HousekeepingTaskStatusDto>
{
    public async Task<Result<HousekeepingTaskStatusDto>> Handle(StartHousekeepingTaskCommand command, CancellationToken ct)
    {
        var task = await db.HousekeepingTasks.FindAsync([command.Id], ct);
        if (task is null)
        {
            return Result.Failure<HousekeepingTaskStatusDto>(Error.NotFoundById("HousekeepingTask", command.Id));
        }

        task.Start();
        await db.SaveChangesAsync(ct);

        return Result.Success(new HousekeepingTaskStatusDto(task.Id, task.Status));
    }
}
