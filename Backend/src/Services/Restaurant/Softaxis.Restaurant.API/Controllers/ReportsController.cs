using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Reports.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Thin wrappers over the Reports/Queries handlers (Epic 8) — read-only, gated on the single
/// restaurant.reports.view key (no create/edit/delete surface).</summary>
[ApiController][Route("api/restaurant/reports")][Authorize][RequirePermission("restaurant.reports.view")]
public sealed class ReportsController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/reports/sales-daily?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("sales-daily")]
    public async Task<IActionResult> SalesDaily([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesDailyReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/sales-by-category?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("sales-by-category")]
    public async Task<IActionResult> SalesByCategory([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesByCategoryReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/sales-by-employee?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("sales-by-employee")]
    public async Task<IActionResult> SalesByEmployee([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesByEmployeeReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/voids-discounts?from=&amp;to=&amp;branchId= — fraud-signal report.</summary>
    [HttpGet("voids-discounts")]
    public async Task<IActionResult> VoidsDiscounts([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVoidsDiscountsReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/kitchen-prep-times?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("kitchen-prep-times")]
    public async Task<IActionResult> KitchenPrepTimes([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetKitchenPrepTimesReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/table-turnover?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("table-turnover")]
    public async Task<IActionResult> TableTurnover([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTableTurnoverReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/tax-summary?from=&amp;to=&amp;branchId=</summary>
    [HttpGet("tax-summary")]
    public async Task<IActionResult> TaxSummary([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTaxSummaryReportQuery(from, to, branchId), ct));

    /// <summary>GET /api/restaurant/reports/x-report?sessionId= — snapshot of a still-open shift.</summary>
    [HttpGet("x-report")]
    public async Task<IActionResult> XReport([FromQuery] Guid sessionId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSessionReportQuery(sessionId), ct));

    /// <summary>GET /api/restaurant/reports/z-report?sessionId= — reconciliation for a closed shift.</summary>
    [HttpGet("z-report")]
    public async Task<IActionResult> ZReport([FromQuery] Guid sessionId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSessionReportQuery(sessionId), ct));
}
