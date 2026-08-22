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
/// Per-owner scorecard spanning leads, opportunities and activities — the "who is actually producing"
/// report. Rows are keyed by owning user id where one exists; legacy records that only ever stored an
/// owner <i>name</i> are grouped by that name instead, so pre-ownership data still appears rather than
/// silently collapsing into "Unassigned".
/// <para>
/// Dates: leads by creation, deals by close date for won/lost, activities by creation. Open pipeline is
/// deliberately point-in-time (a date window would make "open value" meaningless).
/// </para>
/// </summary>
internal sealed class GetSalesPerformanceReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetSalesPerformanceReportQuery, SalesPerformanceReportDto>
{
    private sealed record Bucket(Guid? UserId, string Name)
    {
        public int LeadsOwned, LeadsConverted, OpenDeals, WonDeals, LostDeals, Activities, Overdue;
        public decimal OpenValue, WonValue;
    }

    public async Task<Result<SalesPerformanceReportDto>> Handle(GetSalesPerformanceReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        var leads = await ApplyLeadFilters(access.ScopeReadable(db.Leads.AsNoTracking()), f)
            .Select(l => new { l.AssignedToUserId, l.AssignedTo, l.Status })
            .ToListAsync(ct);

        var dealQuery = ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f);
        // Open deals are a snapshot; closed deals honour the date window.
        var openDeals = await dealQuery.Where(d => d.Stage != "won" && d.Stage != "lost")
            .Select(d => new { d.AssignedToUserId, d.AssignedTo, d.Value }).ToListAsync(ct);
        var closedDeals = await ApplyDealClosedWindow(
                dealQuery.Where(d => d.ClosedAt != null && (d.Stage == "won" || d.Stage == "lost")), f)
            .Select(d => new { d.AssignedToUserId, d.AssignedTo, d.Value, d.Stage }).ToListAsync(ct);

        var activityQuery = access.ScopeActivities(db.Activities.AsNoTracking()).Where(a => !a.IsDeleted);
        if (f.FromInclusive is DateTime af) activityQuery = activityQuery.Where(a => a.CreatedAt >= af);
        if (f.ToInclusive is DateTime at) activityQuery = activityQuery.Where(a => a.CreatedAt <= at);
        var activities = await activityQuery
            .Select(a => new { a.AssignedTo, a.Completed, a.DueDate }).ToListAsync(ct);

        // Key by user id when present, otherwise by the display name — see the class remarks.
        var buckets = new Dictionary<string, Bucket>(StringComparer.OrdinalIgnoreCase);
        // Name → bucket key, so a record that carries only an owner NAME lands in that person's
        // existing id-keyed bucket instead of creating a second row for the same human. Activities
        // have no owner id at all, so without this every user would appear twice: once with their
        // revenue and once with their activity count.
        var byName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        Bucket For(Guid? id, string? name)
        {
            var display = Fallback(name, "Unassigned");
            var key = id?.ToString()
                   ?? (byName.TryGetValue(display, out var existing) ? existing : $"name:{display}");

            if (!buckets.TryGetValue(key, out var b))
            {
                buckets[key] = b = new Bucket(id, display);
            }
            // First writer of a given name owns the mapping; later name-only records join it.
            if (!byName.ContainsKey(display)) byName[display] = key;
            return b;
        }

        foreach (var l in leads)
        {
            var b = For(l.AssignedToUserId, l.AssignedTo);
            b.LeadsOwned++;
            if (l.Status == "converted") b.LeadsConverted++;
        }
        foreach (var d in openDeals)
        {
            var b = For(d.AssignedToUserId, d.AssignedTo);
            b.OpenDeals++; b.OpenValue += d.Value;
        }
        foreach (var d in closedDeals)
        {
            var b = For(d.AssignedToUserId, d.AssignedTo);
            if (d.Stage == "won") { b.WonDeals++; b.WonValue += d.Value; } else b.LostDeals++;
        }
        foreach (var a in activities)
        {
            // Activities carry only an owner name (no user id on the entity), so they always group by name.
            var b = For(null, a.AssignedTo);
            b.Activities++;
            if (!a.Completed && a.DueDate != null && string.CompareOrdinal(a.DueDate, today) < 0) b.Overdue++;
        }

        var owners = buckets.Values
            .Select(b => new OwnerPerformanceRowDto(
                b.UserId, b.Name, b.LeadsOwned, b.LeadsConverted, Rate(b.LeadsConverted, b.LeadsOwned),
                b.OpenDeals, b.OpenValue, b.WonDeals, b.WonValue, b.LostDeals,
                Rate(b.WonDeals, b.WonDeals + b.LostDeals), b.Activities, b.Overdue))
            .OrderByDescending(o => o.WonValue).ThenByDescending(o => o.OpenValue)
            .ToList();

        // ── Team grouping ────────────────────────────────────────────────────
        // Visibility comes from the guard: full access → every team in the tenant, team lead → only
        // the teams they lead. A user in several teams appears under each, which is deliberate —
        // their numbers genuinely count toward every team they are part of, and hiding them from
        // all but one would make a team's totals wrong.
        var visibleTeams = await access.VisibleTeamsAsync(ct);
        var ownersById = owners.Where(o => o.OwnerUserId is not null)
                               .ToDictionary(o => o.OwnerUserId!.Value);

        var teams = new List<TeamPerformanceDto>();
        var groupedUserIds = new HashSet<Guid>();

        foreach (var team in visibleTeams)
        {
            var members = new List<OwnerPerformanceRowDto>();
            foreach (var memberId in team.MemberUserIds)
            {
                if (!ownersById.TryGetValue(memberId, out var row)) continue;
                members.Add(row);
                groupedUserIds.Add(memberId);
            }

            var leadName = team.TeamLeadUserId is { } leadId && ownersById.TryGetValue(leadId, out var lead)
                ? lead.OwnerName
                : null;

            teams.Add(new TeamPerformanceDto(
                team.Id, team.Name, leadName,
                members.OrderByDescending(m => m.WonValue).ToList(),
                members.Sum(m => m.LeadsOwned),
                members.Sum(m => m.WonDeals),
                members.Sum(m => m.WonValue),
                members.Sum(m => m.OpenValue)));
        }

        // Anyone the caller can see who is in none of those teams. Includes name-keyed rows (legacy
        // records with an owner name but no user id) — they have no team to belong to.
        var ungrouped = owners
            .Where(o => o.OwnerUserId is null || !groupedUserIds.Contains(o.OwnerUserId.Value))
            .ToList();

        return Result.Success(new SalesPerformanceReportDto(
            owners, owners.Sum(o => o.WonValue), owners.Sum(o => o.WonDeals),
            teams.OrderByDescending(t => t.TotalWonValue).ThenBy(t => t.TeamName).ToList(),
            ungrouped));
    }
}
