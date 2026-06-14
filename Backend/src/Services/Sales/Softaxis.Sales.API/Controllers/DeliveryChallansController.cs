using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.DeliveryChallans.Commands;
using Softaxis.Sales.Application.DeliveryChallans.Queries;

namespace Softaxis.Sales.API.Controllers;

[Route("api/sales/delivery-challans")]
[Authorize]
public sealed class DeliveryChallansController(ISender sender) : SalesControllerBase
{
    // ── GET /api/sales/delivery-challans ───────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? salesOrderId,
        [FromQuery] Guid? customerId,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetDeliveryChallansQuery(salesOrderId, customerId), ct);
        return OkOrError(result);
    }

    // ── GET /api/sales/delivery-challans/{id} ──────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetDeliveryChallanByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/sales/delivery-challans ──────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDeliveryChallanCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
