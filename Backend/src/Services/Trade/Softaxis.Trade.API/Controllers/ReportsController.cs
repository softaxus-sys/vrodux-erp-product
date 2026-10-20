using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Trade.API.Authorization;
using Softaxis.Trade.API.Controllers.Common;
using Softaxis.Trade.Application.Reports;

namespace Softaxis.Trade.API.Controllers;

/// <summary>
/// Trade reports for the central Reports hub. The attribute is only the coarse "may this user touch
/// Trade reports at all" gate; the handler then requires the permission of the area each report reads.
/// </summary>
[Route("api/trade/reports")][Authorize]
public sealed class ReportsController(ISender sender) : TradeControllerBase
{
    [HttpGet("run/{reportId}")]
    [RequirePermission("trade.shipments.view", "trade.costs.view", "trade.payments.view", "trade.documents.view")]
    public async Task<IActionResult> Run(
        string reportId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] DateOnly? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunTradeReportQuery(reportId, from, to, today), ct));
}
