using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Dashboard.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>5 role-scoped dashboards (Epic 8) — each a thin aggregation over the same order/table/
/// kitchen/inventory data the report handlers use. Gated on the single restaurant.reports.view key;
/// which tabs a role actually sees is a frontend concern (a cashier isn't shown the Owner tab, etc.),
/// not a separate permission per dashboard.</summary>
[ApiController][Route("api/restaurant/dashboard")][Authorize][RequirePermission("restaurant.reports.view")]
public sealed class DashboardController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/dashboard/owner?branchId=</summary>
    [HttpGet("owner")]
    public async Task<IActionResult> Owner([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetOwnerDashboardQuery(branchId), ct));

    /// <summary>GET /api/restaurant/dashboard/branch?branchId=</summary>
    [HttpGet("branch")]
    public async Task<IActionResult> Branch([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBranchDashboardQuery(branchId), ct));

    /// <summary>GET /api/restaurant/dashboard/kitchen?branchId=</summary>
    [HttpGet("kitchen")]
    public async Task<IActionResult> Kitchen([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetKitchenDashboardQuery(branchId), ct));

    /// <summary>GET /api/restaurant/dashboard/cashier?sessionId=</summary>
    [HttpGet("cashier")]
    public async Task<IActionResult> Cashier([FromQuery] Guid? sessionId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCashierDashboardQuery(sessionId), ct));

    /// <summary>GET /api/restaurant/dashboard/inventory</summary>
    [HttpGet("inventory")]
    public async Task<IActionResult> Inventory(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetInventoryDashboardQuery(), ct));
}
