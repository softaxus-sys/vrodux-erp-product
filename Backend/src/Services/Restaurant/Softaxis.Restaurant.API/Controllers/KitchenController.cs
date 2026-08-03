using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Kitchen.Commands;
using Softaxis.Restaurant.Application.Kitchen.Queries;
using Softaxis.Restaurant.Application.Orders.Commands;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/kitchen")][Authorize]
public sealed class KitchenController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/kitchen/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.kitchen.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetKitchenSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/kitchen/tickets?stationId=</summary>
    [HttpGet("tickets")]
    [RequirePermission("restaurant.kitchen.view")]
    public async Task<IActionResult> GetTickets([FromQuery] Guid? stationId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetKitchenTicketsQuery(stationId), ct));

    /// <summary>PATCH /api/restaurant/kitchen/orders/{id}/ready — same command as OrdersController.MarkReady;
    /// exposed here too since the KDS marks orders ready without going through the order-drawer UI.</summary>
    [HttpPatch("orders/{id:guid}/ready")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> MarkReady(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkOrderReadyCommand(id), ct));

    /// <summary>PATCH /api/restaurant/kitchen/items/{id}/status</summary>
    [HttpPatch("items/{id:guid}/status")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> UpdateItemStatus(Guid id, [FromBody] UpdateItemStatusReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateOrderItemStatusCommand(id, req.Status), ct));

    public record UpdateItemStatusReq(string Status);
}
