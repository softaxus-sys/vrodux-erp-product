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
/// Which lead sources actually produce revenue — leads in, conversion rate, and the won value of the
/// opportunities those leads became. Won value is attributed by tracing each converted lead to the deal
/// it created (<c>Lead.ConvertedDealId</c>) rather than by matching on <c>Deal.Source</c>, because a
/// deal's own source field is free-form and frequently differs from the originating lead's.
/// Dates apply to lead creation, so a source is judged on the leads it delivered in the period.
/// </summary>
internal sealed class GetLeadSourceReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetLeadSourceReportQuery, LeadSourceReportDto>
{
    public async Task<Result<LeadSourceReportDto>> Handle(GetLeadSourceReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        var leads = await ApplyLeadFilters(access.ScopeReadable(db.Leads.AsNoTracking()), f)
            .Select(l => new { l.Source, l.Status, l.Score, l.EstimatedValue, l.CreatedAt, l.ConvertedAt, l.ConvertedDealId })
            .ToListAsync(ct);

        // Deal ids are stored on the lead as strings; parse once so the lookup below is a plain join.
        var dealIds = leads
            .Select(l => Guid.TryParse(l.ConvertedDealId, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .Distinct()
            .ToList();

        var wonByDeal = dealIds.Count == 0
            ? new Dictionary<Guid, decimal>()
            : await access.ScopeDeals(db.Deals.AsNoTracking())
                .Where(d => !d.IsDeleted && d.Stage == "won" && dealIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => d.Value, ct);

        var sources = leads
            .GroupBy(l => Fallback(l.Source, "unknown"))
            .Select(g =>
            {
                var converted = g.Where(l => l.Status == "converted").ToList();

                var wonDeals = 0; decimal wonValue = 0;
                foreach (var l in converted)
                {
                    if (Guid.TryParse(l.ConvertedDealId, out var id) && wonByDeal.TryGetValue(id, out var v))
                    { wonDeals++; wonValue += v; }
                }

                return new LeadSourceRowDto(
                    g.Key, g.Count(), converted.Count, Rate(converted.Count, g.Count()),
                    g.Sum(l => l.EstimatedValue), wonDeals, wonValue,
                    Avg(g.Select(l => (double)l.Score)),
                    Avg(converted.Where(l => l.ConvertedAt != null)
                                 .Select(l => (l.ConvertedAt!.Value - l.CreatedAt).TotalDays)));
            })
            .OrderByDescending(s => s.WonValue).ThenByDescending(s => s.Leads)
            .ToList();

        var totalConverted = leads.Count(l => l.Status == "converted");

        return Result.Success(new LeadSourceReportDto(
            sources, leads.Count, totalConverted, Rate(totalConverted, leads.Count)));
    }
}
