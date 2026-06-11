using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Application.Activities.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class GetActivitiesSummaryHandler(CrmDbContext db) : IQueryHandler<GetActivitiesSummaryQuery, ActivitiesSummaryDto>
{
    public async Task<Result<ActivitiesSummaryDto>> Handle(GetActivitiesSummaryQuery query, CancellationToken ct)
    {
        var open = await db.Activities.AsNoTracking().Where(a => !a.Completed).ToListAsync(ct);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        return Result.Success(new ActivitiesSummaryDto(
            open.Count,
            open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) < 0),
            open.Count(a => a.DueDate == today),
            open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) > 0)));
    }
}
