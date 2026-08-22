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
/// Won/lost outcomes, monthly trend and loss-reason breakdown. The date window applies to
/// <c>ClosedAt</c> — the actual outcome date, not the forecast <c>ExpectedCloseDate</c>.
/// Deals closed before close-date tracking existed are backfilled at startup; any that could not be
/// dated are excluded here rather than being dumped into an arbitrary month.
/// </summary>
internal sealed class GetWinLossReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetWinLossReportQuery, WinLossReportDto>
{
    public async Task<Result<WinLossReportDto>> Handle(GetWinLossReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        var closed = await ApplyDealClosedWindow(
                ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f)
                    .Where(d => d.ClosedAt != null && (d.Stage == "won" || d.Stage == "lost")), f)
            .Select(d => new { d.Stage, d.Value, d.LossReason, d.ClosedAt, d.CreatedAt })
            .ToListAsync(ct);

        var won  = closed.Where(d => d.Stage == "won").ToList();
        var lost = closed.Where(d => d.Stage == "lost").ToList();

        var trend = closed
            .GroupBy(d => MonthKey(d.ClosedAt!.Value))
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var w = g.Count(d => d.Stage == "won");
                var l = g.Count(d => d.Stage == "lost");
                return new WinLossTrendPointDto(
                    g.Key, w, l,
                    g.Where(d => d.Stage == "won").Sum(d => d.Value),
                    g.Where(d => d.Stage == "lost").Sum(d => d.Value),
                    Rate(w, w + l));
            })
            .ToList();

        var lossReasons = lost
            .GroupBy(d => Fallback(d.LossReason, "Not recorded"))
            .Select(g => new LossReasonRowDto(g.Key, g.Count(), g.Sum(d => d.Value), Rate(g.Count(), lost.Count)))
            .OrderByDescending(x => x.Count)
            .ToList();

        var wonValue = won.Sum(d => d.Value);

        return Result.Success(new WinLossReportDto(
            won.Count, lost.Count, wonValue, lost.Sum(d => d.Value),
            Rate(won.Count, closed.Count),
            won.Count == 0 ? 0 : Math.Round(wonValue / won.Count, 2),
            Avg(closed.Select(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays)),
            trend, lossReasons));
    }
}
