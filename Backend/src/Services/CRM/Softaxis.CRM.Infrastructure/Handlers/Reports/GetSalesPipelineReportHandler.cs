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
/// Open pipeline by stage and forecast category. The date window applies to deal <b>creation</b> —
/// an open deal has no close date, so filtering on one would return nothing.
/// </summary>
internal sealed class GetSalesPipelineReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetSalesPipelineReportQuery, SalesPipelineReportDto>
{
    public async Task<Result<SalesPipelineReportDto>> Handle(GetSalesPipelineReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        var rows = await ApplyDealCreatedWindow(ApplyDealFilters(access.ScopeDeals(db.Deals.AsNoTracking()), f), f)
            .Select(d => new { d.Stage, d.Value, d.Probability, d.ForecastCategory })
            .ToListAsync(ct);

        var byStage = DealStages
            .Select(stage =>
            {
                var inStage = rows.Where(r => r.Stage == stage).ToList();
                var value = inStage.Sum(r => r.Value);
                return new PipelineStageRowDto(
                    stage, inStage.Count, value,
                    Math.Round(inStage.Sum(r => r.Value * r.Probability / 100m), 2),
                    inStage.Count == 0 ? 0 : Math.Round(value / inStage.Count, 2));
            })
            .ToList();

        // Anything not yet won or lost is still in play — that is what "open pipeline" means.
        var open = rows.Where(r => r.Stage is not "won" and not "lost").ToList();

        var byForecast = open
            .GroupBy(r => Fallback(r.ForecastCategory, "pipeline"))
            .Select(g => new ForecastCategoryRowDto(g.Key, g.Count(), g.Sum(r => r.Value)))
            .OrderByDescending(x => x.Value)
            .ToList();

        var openValue = open.Sum(r => r.Value);

        return Result.Success(new SalesPipelineReportDto(
            byStage,
            byForecast,
            open.Count,
            openValue,
            Math.Round(open.Sum(r => r.Value * r.Probability / 100m), 2),
            open.Where(r => r.ForecastCategory == "commit").Sum(r => r.Value),
            open.Where(r => r.ForecastCategory == "best_case").Sum(r => r.Value),
            open.Count == 0 ? 0 : Math.Round(openValue / open.Count, 2)));
    }
}
