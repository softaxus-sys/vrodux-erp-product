using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Application.Activities.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class GetActivitiesHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetActivitiesQuery, IReadOnlyList<ActivityDto>>
{
    public async Task<Result<IReadOnlyList<ActivityDto>>> Handle(GetActivitiesQuery query, CancellationToken ct)
    {
        // Assigned-only users see only activities on the leads they own; full-view users see all.
        var q = access.ScopeActivities(db.Activities.AsNoTracking());
        if (!string.IsNullOrWhiteSpace(query.RelatedToType)) q = q.Where(a => a.RelatedToType == query.RelatedToType);
        if (query.RelatedToId.HasValue)                      q = q.Where(a => a.RelatedToId == query.RelatedToId.Value);
        if (query.Completed.HasValue)                        q = q.Where(a => a.Completed == query.Completed.Value);
        if (!string.IsNullOrWhiteSpace(query.Type))          q = q.Where(a => a.Type == query.Type);

        var items = await q
            .OrderBy(a => a.Completed)
            .ThenBy(a => a.DueDate == null)
            .ThenBy(a => a.DueDate)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ActivityDto>>(items.Select(ActivityMappings.ToDto).ToList());
    }
}
