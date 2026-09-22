using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.Dashboard;

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
}
