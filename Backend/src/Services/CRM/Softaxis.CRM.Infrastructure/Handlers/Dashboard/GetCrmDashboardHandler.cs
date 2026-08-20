using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Dashboard.Dtos;
using Softaxis.CRM.Application.Dashboard.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Dashboard;

internal sealed class GetCrmDashboardHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetCrmDashboardQuery, CrmDashboardDto>
{
    public async Task<Result<CrmDashboardDto>> Handle(GetCrmDashboardQuery query, CancellationToken ct)
    {
        // Exclude soft-deleted rows so the dashboard counts match the Leads/Deals list + summary
        // (the tenant global filter overwrites any !IsDeleted entity filter, so filter manually).
        // Lead figures follow the caller's tier (all / their team / their own) so the dashboard
        // cannot be used to infer totals for leads the user is not allowed to open.
        // NOTE: deals are NOT lead-scoped — they have no per-tier model of their own yet.
        var leads = await access.ScopeReadable(db.Leads.AsNoTracking()).Where(l => !l.IsDeleted).Select(l => new { l.Status, l.Source, l.EstimatedValue }).ToListAsync(ct);
        var deals = await db.Deals.AsNoTracking().Where(d => !d.IsDeleted).Select(d => new { d.Stage, d.Value }).ToListAsync(ct);

        string[] leadStages = ["new", "contacted", "qualified", "converted"];
        var funnel = leadStages.Select(s => new LeadFunnelStageDto(s, leads.Count(l => l.Status == s))).ToList();

        var bySource = leads.GroupBy(l => string.IsNullOrWhiteSpace(l.Source) ? "other" : l.Source)
            .Select(g => new LeadsBySourceDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ToList();

        string[] dealStages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
        var pipeline = dealStages.Select(s => new PipelineStageDto(
            s, deals.Count(d => d.Stage == s), deals.Where(d => d.Stage == s).Sum(d => d.Value))).ToList();

        var won = deals.Where(d => d.Stage == "won").ToList();
        var lost = deals.Count(d => d.Stage == "lost");
        var openDeals = deals.Where(d => d.Stage is not "won" and not "lost").ToList();
        var totalClosed = won.Count + lost;

        var todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var openActs = await db.Activities.AsNoTracking().Where(a => !a.IsDeleted && !a.Completed).Select(a => a.DueDate).ToListAsync(ct);

        return Result.Success(new CrmDashboardDto(
            funnel, bySource, pipeline,
            openDeals.Sum(d => d.Value), won.Sum(d => d.Value), won.Count, lost,
            totalClosed > 0 ? Math.Round((double)won.Count / totalClosed * 100, 1) : 0,
            leads.Count, deals.Count, openActs.Count,
            openActs.Count(d => d != null && string.CompareOrdinal(d, todayStr) < 0)));
    }
}
