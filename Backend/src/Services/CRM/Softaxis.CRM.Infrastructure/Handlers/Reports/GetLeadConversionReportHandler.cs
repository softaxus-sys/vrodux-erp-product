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
/// Lead funnel with step-to-step drop-off, monthly conversion trend, and time-to-convert.
/// <para>
/// The funnel counts leads by their <b>current</b> status, which is what the data supports: leads have no
/// per-status history (only opportunities do). So a lead sitting at "qualified" is counted there and not
/// also in "contacted". The step rate is therefore a snapshot shape, not a true cohort progression —
/// stated here so the number is not read as something it isn't.
/// </para>
/// Dates apply to lead creation; the trend attributes a conversion to the month the lead was created,
/// so each cohort's rate is honest rather than mixing in conversions of older leads.
/// </summary>
internal sealed class GetLeadConversionReportHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetLeadConversionReportQuery, LeadConversionReportDto>
{
    public async Task<Result<LeadConversionReportDto>> Handle(GetLeadConversionReportQuery query, CancellationToken ct)
    {
        var f = query.Filter;

        var leads = await ApplyLeadFilters(access.ScopeReadable(db.Leads.AsNoTracking()), f)
            .Select(l => new { l.Status, l.Score, l.CreatedAt, l.ConvertedAt })
            .ToListAsync(ct);

        var total = leads.Count;

        // Cumulative reach: a converted lead necessarily passed through every earlier step.
        var funnel = new List<FunnelStageDto>();
        int? previousReach = null;
        for (var i = 0; i < LeadStatuses.Length; i++)
        {
            var reach = leads.Count(l => Array.IndexOf(LeadStatuses, l.Status) >= i);
            funnel.Add(new FunnelStageDto(
                LeadStatuses[i], reach, Rate(reach, total),
                previousReach is null ? 100 : Rate(reach, previousReach.Value)));
            previousReach = reach;
        }

        var trend = leads
            .GroupBy(l => MonthKey(l.CreatedAt))
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var conv = g.Count(l => l.Status == "converted");
                return new ConversionTrendPointDto(g.Key, g.Count(), conv, Rate(conv, g.Count()));
            })
            .ToList();

        var converted = leads.Where(l => l.Status == "converted").ToList();

        return Result.Success(new LeadConversionReportDto(
            funnel, trend, total, converted.Count, Rate(converted.Count, total),
            Avg(converted.Where(l => l.ConvertedAt != null)
                         .Select(l => (l.ConvertedAt!.Value - l.CreatedAt).TotalDays)),
            Avg(converted.Select(l => (double)l.Score)),
            Avg(leads.Where(l => l.Status != "converted").Select(l => (double)l.Score))));
    }
}
