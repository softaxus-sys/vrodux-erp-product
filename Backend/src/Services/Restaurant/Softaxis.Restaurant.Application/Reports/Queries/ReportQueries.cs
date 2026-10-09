using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reports.Dtos;

namespace Softaxis.Restaurant.Application.Reports.Queries;

/// <summary>GET /api/restaurant/reports/sales-daily?from=&amp;to=&amp;branchId=</summary>
public sealed record GetSalesDailyReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<SalesDailyRow>>;

/// <summary>GET /api/restaurant/reports/sales-by-category?from=&amp;to=&amp;branchId=</summary>
public sealed record GetSalesByCategoryReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<SalesByCategoryRow>>;

/// <summary>GET /api/restaurant/reports/sales-by-employee?from=&amp;to=&amp;branchId=</summary>
public sealed record GetSalesByEmployeeReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<SalesByEmployeeRow>>;

/// <summary>GET /api/restaurant/reports/voids-discounts?from=&amp;to=&amp;branchId=</summary>
public sealed record GetVoidsDiscountsReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<VoidsAndDiscountsRow>>;

/// <summary>GET /api/restaurant/reports/kitchen-prep-times?from=&amp;to=&amp;branchId= — only items
/// that reached "ready" (ReadyAt set) are included; items served through the KDS-less quick actions
/// before this report existed have no timing data and are naturally excluded, not zeroed-out.</summary>
public sealed record GetKitchenPrepTimesReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<KitchenPrepTimeRow>>;

/// <summary>GET /api/restaurant/reports/table-turnover?from=&amp;to=&amp;branchId= — derived from
/// Order.CreatedAt/UpdatedAt on paid orders per table (no separate turnover log table).</summary>
public sealed record GetTableTurnoverReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<TableTurnoverRow>>;

/// <summary>GET /api/restaurant/reports/tax-summary?from=&amp;to=&amp;branchId=</summary>
public sealed record GetTaxSummaryReportQuery(DateOnly From, DateOnly To, Guid? BranchId = null) : IQuery<IReadOnlyList<TaxSummaryRow>>;

/// <summary>GET /api/restaurant/reports/z-report?sessionId= / /x-report?sessionId= — same handler,
/// the controller exposes both routes (Z = closed session, X = still-open snapshot).</summary>
public sealed record GetSessionReportQuery(Guid SessionId) : IQuery<SessionReportDto>;

/// <summary>GET /api/restaurant/reports/shifts — recent till shifts to pick a Z/X report from, newest first.</summary>
public sealed record GetReportShiftsQuery : IQuery<IReadOnlyList<ReportShiftDto>>;

/// <summary>GET /api/restaurant/reports/run/{reportId} — one report for the central Reports hub, as a
/// table. <c>UtcOffsetMinutes</c> is the caller's clock, so "today" and each hour are theirs.</summary>
public sealed record RunRestaurantReportQuery(
    string ReportId, DateOnly From, DateOnly To, int UtcOffsetMinutes = 0,
    string? OrderType = null, string? Status = null) : IQuery<TabularReportDto>;
