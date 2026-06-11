using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Commands;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class CreateHousekeepingTaskHandler(HospitalityDbContext db) : ICommandHandler<CreateHousekeepingTaskCommand, HousekeepingTaskStatusDto>
{
    public async Task<Result<HousekeepingTaskStatusDto>> Handle(CreateHousekeepingTaskCommand command, CancellationToken ct)
    {
        var task = new HousekeepingTask(command.RoomId, command.RoomNumber, command.TaskType, command.Priority, command.Notes);
        if (!string.IsNullOrEmpty(command.AssignedTo))
        {
            task.Assign(command.AssignedTo);
        }

        db.HousekeepingTasks.Add(task);
        await db.SaveChangesAsync(ct);

        return Result.Success(new HousekeepingTaskStatusDto(task.Id, task.Status));
    }
}
