using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.Dashboard;
using Softaxis.POS.Application.Stock;

namespace Softaxis.POS.API.Controllers;

/// <summary>Retail POS dashboard (takings, trend, payment mix, top products, live shifts).</summary>
[Authorize]
[Route("api/pos-dashboard")]
public sealed class PosDashboardController(ISender sender) : BaseApiController(sender)
{
    [RequirePermission("pos.reports.view")]
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int utcOffsetMinutes = 0,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPosOverviewQuery(from, to, utcOffsetMinutes), ct));

    /// <summary>What each branch holds of each product (reported by the branch servers).</summary>
    [RequireAnyPermission("pos.reports.view", "pos.products.view")]
    [HttpGet("branch-stock")]
    public async Task<IActionResult> GetBranchStock(
        [FromQuery] Guid? productId = null, [FromQuery] Guid? branchId = null, [FromQuery] string? search = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetBranchStockQuery(productId, branchId, search), ct));

    /// <summary>Every product that is out of stock or at/below its reorder level — the buying list.</summary>
    [RequireAnyPermission("pos.reports.view", "pos.products.view")]
    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock([FromQuery] int salesDays = 30, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetLowStockReportQuery(salesDays), ct));
}
