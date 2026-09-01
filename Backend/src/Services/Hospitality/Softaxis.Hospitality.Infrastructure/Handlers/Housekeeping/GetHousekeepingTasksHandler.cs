using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Application.Housekeeping.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class GetHousekeepingTasksHandler(HospitalityDbContext db) : IQueryHandler<GetHousekeepingTasksQuery, PagedResult<HousekeepingTaskDto>>
{
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<HousekeepingTaskDto>>> Handle(GetHousekeepingTasksQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var q = db.HousekeepingTasks.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.TaskType))
            q = q.Where(x => x.TaskType == query.TaskType);

        // The fields housekeeping actually looks a task up by.
        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.RoomNumber.Contains(query.Search)
                          || (x.AssignedTo != null && x.AssignedTo.Contains(query.Search)));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderBy(x => x.Status).ThenBy(x => x.Priority)
            .ThenBy(x => x.Id)              // stable: most rows share a status and a priority
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<HousekeepingTaskDto>.Create(
            items.Select(HousekeepingMappings.ToDto).ToList(), total, page, pageSize));
    }
}
