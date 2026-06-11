using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal static class HousekeepingMappings
{
    public static HousekeepingTaskDto ToDto(HousekeepingTask t) => new(
        t.Id, t.RoomId, t.RoomNumber, t.TaskType, t.Priority, t.Status,
        t.AssignedTo, t.StartedAt, t.CompletedAt, t.Notes);
}
