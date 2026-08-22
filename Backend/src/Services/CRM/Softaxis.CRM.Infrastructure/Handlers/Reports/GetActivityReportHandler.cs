using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Reports.Dtos;
using Softaxis.CRM.Application.Reports.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;
using static Softaxis.CRM.Infrastructure.Handlers.Reports.ReportQueryHelpers;

namespace Softaxis.CRM.Infrastructure.Handlers.Reports;

/// <summary>
/// Activity volume, completion and overdue load, by type and by owner — the leading indicator that
/// explains next quarter's pipeline. Dates apply to activity creation.
/// <para>
/// Overdue compares the stored <c>yyyy-MM-dd</c> due date as an ordinal string, matching how the CRM
/// dashboard and list screens already do it, so the counts agree across screens.
/// </para>
/// </summary>
internal sealed class GetActivityReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetActivityReportQuery, ActivityReportDto>
{
    public async Task<Result<ActivityReportDto>> Handle(GetActivityReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        var q = access.ScopeActivities(db.Activities.AsNoTracking()).Where(a => !a.IsDeleted);
        if (f.FromInclusive is DateTime from) q = q.Where(a => a.CreatedAt >= from);
        if (f.ToInclusive is DateTime to) q = q.Where(a => a.CreatedAt <= to);

        var rows = await q.Select(a => new { a.Type, a.AssignedTo, a.Completed, a.DueDate }).ToListAsync(ct);

        bool IsOverdue(bool completed, string? due) =>
            !completed && due != null && string.CompareOrdinal(due, today) < 0;

        var byType = rows
            .GroupBy(a => Fallback(a.Type, "task"))
            .Select(g => new ActivityTypeRowDto(
                g.Key, g.Count(), g.Count(a => a.Completed), g.Count(a => !a.Completed),
                g.Count(a => IsOverdue(a.Completed, a.DueDate))))
            .OrderByDescending(x => x.Total)
            .ToList();

        var byOwner = rows
            .GroupBy(a => Fallback(a.AssignedTo, "Unassigned"))
            .Select(g =>
            {
                var completed = g.Count(a => a.Completed);
                return new ActivityOwnerRowDto(
                    g.Key, g.Count(), completed, g.Count(a => !a.Completed),
                    g.Count(a => IsOverdue(a.Completed, a.DueDate)), Rate(completed, g.Count()));
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        var totalCompleted = rows.Count(a => a.Completed);

        return Result.Success(new ActivityReportDto(
            byType, byOwner, rows.Count, totalCompleted, rows.Count - totalCompleted,
            rows.Count(a => IsOverdue(a.Completed, a.DueDate)), Rate(totalCompleted, rows.Count)));
    }
}
