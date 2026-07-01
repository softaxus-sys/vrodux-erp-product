using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.DeliveryChallans.Commands;
using Softaxis.Sales.Application.DeliveryChallans.Queries;

namespace Softaxis.Sales.API.Controllers;

// Delivery challans are order fulfillment (they drive SalesOrder status → shipped/delivered);
// there is no dedicated permission key, so they gate on the nearest one (sales.orders.*).
[Route("api/sales/delivery-challans")]
[Authorize]
public sealed class DeliveryChallansController(ISender sender) : SalesControllerBase
{
    // ── GET /api/sales/delivery-challans ───────────────────────────────────
    [HttpGet]
    [RequirePermission("sales.orders.view")]
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
    [RequirePermission("sales.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetDeliveryChallanByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/sales/delivery-challans ──────────────────────────────────
    // Creating a challan advances an existing order's fulfillment → gate on order edit.
    [HttpPost]
    [RequirePermission("sales.orders.edit")]
    public async Task<IActionResult> Create([FromBody] CreateDeliveryChallanCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
