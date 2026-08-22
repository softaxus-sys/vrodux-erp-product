using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Reports.Dtos;

namespace Softaxis.CRM.Application.Reports.Queries;

/// <summary>Open pipeline by stage and forecast category. Ignores the date filter's close-date meaning
/// and applies it to deal creation, since an open deal has no close date yet.</summary>
public sealed record GetSalesPipelineReportQuery(ReportFilter Filter) : IQuery<SalesPipelineReportDto>;

/// <summary>Won/lost outcomes over time plus loss-reason breakdown. Dates apply to <c>ClosedAt</c>.</summary>
public sealed record GetWinLossReportQuery(ReportFilter Filter) : IQuery<WinLossReportDto>;

/// <summary>Per-owner scorecard across leads, opportunities and activities.</summary>
public sealed record GetSalesPerformanceReportQuery(ReportFilter Filter) : IQuery<SalesPerformanceReportDto>;

/// <summary>Which lead sources actually produce revenue. Dates apply to lead creation.</summary>
public sealed record GetLeadSourceReportQuery(ReportFilter Filter) : IQuery<LeadSourceReportDto>;

/// <summary>Lead funnel, conversion rate over time and time-to-convert. Dates apply to lead creation.</summary>
public sealed record GetLeadConversionReportQuery(ReportFilter Filter) : IQuery<LeadConversionReportDto>;

/// <summary>Average time spent in each stage and overall sales-cycle length, from the stage-history
/// trail. Dates apply to when the transition happened.</summary>
public sealed record GetVelocityReportQuery(ReportFilter Filter) : IQuery<VelocityReportDto>;

/// <summary>Activity volume, completion and overdue load by type and owner. Dates apply to creation.</summary>
public sealed record GetActivityReportQuery(ReportFilter Filter) : IQuery<ActivityReportDto>;

/// <summary>Revenue and pipeline rolled up per account. Dates apply to deal close date.</summary>
public sealed record GetAccountRevenueReportQuery(ReportFilter Filter) : IQuery<AccountRevenueReportDto>;
