using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Application.Housekeeping.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class GetHousekeepingTasksHandler(HospitalityDbContext db) : IQueryHandler<GetHousekeepingTasksQuery, IReadOnlyList<HousekeepingTaskDto>>
{
    public async Task<Result<IReadOnlyList<HousekeepingTaskDto>>> Handle(GetHousekeepingTasksQuery query, CancellationToken ct)
    {
        var items = await db.HousekeepingTasks.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Status).ThenBy(x => x.Priority).ToListAsync(ct);

        return Result.Success<IReadOnlyList<HousekeepingTaskDto>>(items.Select(HousekeepingMappings.ToDto).ToList());
    }
}
