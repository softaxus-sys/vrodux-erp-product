using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Application.Activities.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class GetActivitiesSummaryHandler(CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser)
    : IQueryHandler<GetActivitiesSummaryQuery, ActivitiesSummaryDto>
{
    public async Task<Result<ActivitiesSummaryDto>> Handle(GetActivitiesSummaryQuery query, CancellationToken ct)
    {
        // Scoped like the list beneath it. It used to count every activity in the workspace, so the
        // tiles disagreed with the rows for anyone who could not see them all.
        var scoped = access.ScopeActivities(db.Activities.AsNoTracking()).Where(a => !a.IsDeleted && !a.Completed);

        if (query.Mine)
        {
            var me = currentUser.Id;
            scoped = me is { } uid ? scoped.Where(a => a.AssignedToUserId == uid) : scoped.Where(_ => false);
        }

        var open = await scoped.ToListAsync(ct);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        return Result.Success(new ActivitiesSummaryDto(
            open.Count,
            open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) < 0),
            open.Count(a => a.DueDate == today),
            open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) > 0)));
    }
}
