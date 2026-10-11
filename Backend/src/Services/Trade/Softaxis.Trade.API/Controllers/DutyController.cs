using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Trade.API.Authorization;
using Softaxis.Trade.API.Controllers.Common;
using Softaxis.Trade.Application.Duty;
using Softaxis.Trade.Application.InTransit;

namespace Softaxis.Trade.API.Controllers;

/// <summary>
/// Duty rates by HS code, the duty estimate for a shipment, and what is on its way by product.
/// Duty rates and the estimate use the costs permissions — duty is a cost of the shipment, and the
/// same people who may see costs may see (and keep) the rates.
/// </summary>
[Route("api/trade")][Authorize]
public sealed class DutyController(ISender sender) : TradeControllerBase
{
    [HttpGet("duty-rates")]
    [RequirePermission("trade.costs.view")]
    public async Task<IActionResult> GetRates([FromQuery] string? search, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDutyRatesQuery(search), ct));

    [HttpPost("duty-rates")]
    [RequirePermission("trade.costs.create")]
    public async Task<IActionResult> CreateRate([FromBody] DutyRateInput rate, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateDutyRateCommand(rate), ct));

    [HttpPut("duty-rates/{id:guid}")]
    [RequirePermission("trade.costs.edit")]
    public async Task<IActionResult> UpdateRate(Guid id, [FromBody] DutyRateInput rate, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDutyRateCommand(id, rate), ct));

    [HttpDelete("duty-rates/{id:guid}")]
    [RequirePermission("trade.costs.delete")]
    public async Task<IActionResult> DeleteRate(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDutyRateCommand(id), ct));

    [HttpGet("shipments/{id:guid}/duty-estimate")]
    [RequirePermission("trade.costs.view")]
    public async Task<IActionResult> Estimate(Guid id, [FromQuery] bool includeFreightInsurance, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDutyEstimateQuery(id, includeFreightInsurance), ct));

    [HttpGet("in-transit")]
    [RequirePermission("trade.shipments.view")]
    public async Task<IActionResult> InTransit(
        [FromQuery] Guid? productId, [FromQuery] string? search, [FromQuery] DateOnly? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetInTransitQuery(productId, search, today), ct));
}
