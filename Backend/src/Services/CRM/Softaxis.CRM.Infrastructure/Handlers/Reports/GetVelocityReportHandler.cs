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
/// Where deals stall: average and median days spent in each stage, plus overall cycle length.
/// <para>
/// Built on <c>DealStageHistory</c>, which only starts accruing from the day stage tracking was
/// deployed. Historic deals have no transitions, so stage figures reflect movement since then — the DTO
/// carries <c>HasHistory</c>/<c>HistoryNote</c> so the UI can say that plainly instead of showing an
/// empty chart that reads as "no deals move".
/// </para>
/// Cycle length is computed from the deals themselves (created → closed), so it works for historic
/// deals too and does not depend on the history table.
/// </summary>
internal sealed class GetVelocityReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetVelocityReportQuery, VelocityReportDto>
{
    public async Task<Result<VelocityReportDto>> Handle(GetVelocityReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        // Only history for deals the caller may read — the join keeps the access tier intact, since the
        // history table has no owner of its own.
        var visibleDeals = ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f).Select(d => d.Id);

        var historyQuery = db.DealStageHistory.AsNoTracking()
            .Where(h => h.FromStage != null && visibleDeals.Contains(h.DealId));
        if (f.FromInclusive is DateTime from) historyQuery = historyQuery.Where(h => h.CreatedAt >= from);
        if (f.ToInclusive is DateTime to) historyQuery = historyQuery.Where(h => h.CreatedAt <= to);

        var moves = await historyQuery
            .Select(h => new { h.FromStage, h.DaysInFromStage })
            .ToListAsync(ct);

        // Current occupancy, so a stage with no completed transitions still shows what is sitting in it.
        var currentByStage = await ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f)
            .GroupBy(d => d.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Stage, x => x.Count, ct);

        var stages = DealStages
            .Where(s => s is not "won" and not "lost")   // terminal stages are exited, never dwelt in
            .Select(stage =>
            {
                var durations = moves.Where(m => m.FromStage == stage).Select(m => m.DaysInFromStage).ToList();
                return new StageDurationRowDto(
                    stage, durations.Count, Avg(durations), Median(durations),
                    currentByStage.TryGetValue(stage, out var c) ? c : 0);
            })
            .ToList();

        var closed = await ApplyDealClosedWindow(
                ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f)
                    .Where(d => d.ClosedAt != null && (d.Stage == "won" || d.Stage == "lost")), f)
            .Select(d => new { d.Stage, d.CreatedAt, d.ClosedAt })
            .ToListAsync(ct);

        var cycles = closed.Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays).ToList();
        var hasHistory = moves.Count > 0;

        return Result.Success(new VelocityReportDto(
            stages,
            Avg(cycles),
            Avg(closed.Where(d => d.Stage == "won").Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays)),
            Avg(closed.Where(d => d.Stage == "lost").Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays)),
            closed.Count,
            hasHistory,
            hasHistory
                ? null
                : "Stage timings build up as deals move between stages from now on. Cycle length below is "
                  + "available immediately because it is measured from each deal's creation and close date."));
    }
}
