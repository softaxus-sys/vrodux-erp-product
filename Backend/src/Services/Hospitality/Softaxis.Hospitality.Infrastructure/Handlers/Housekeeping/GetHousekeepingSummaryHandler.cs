using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;
using Softaxis.Hospitality.Application.Housekeeping.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Housekeeping;

internal sealed class GetHousekeepingSummaryHandler(HospitalityDbContext db) : IQueryHandler<GetHousekeepingSummaryQuery, HousekeepingSummaryDto>
{
    public async Task<Result<HousekeepingSummaryDto>> Handle(GetHousekeepingSummaryQuery query, CancellationToken ct)
    {
        var all = await db.HousekeepingTasks.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Priority, x.TaskType }).ToListAsync(ct);

        return Result.Success(new HousekeepingSummaryDto(
            all.Count,
            all.Count(x => x.Status == "pending"),
            all.Count(x => x.Status == "in_progress"),
            all.Count(x => x.Status == "completed"),
            all.Count(x => x.Status == "verified"),
            all.Count(x => x.Priority == "urgent"),
            all.Count(x => x.Priority == "high")));
    }
}
