using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.DeliveryOrders.Commands;
using Softaxis.Restaurant.Application.DeliveryOrders.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/delivery")][Authorize]
public sealed class DeliveryOrdersController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/delivery/providers — the dispatch-channel catalog (manual + third-party stubs).</summary>
    [HttpGet("providers")]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetProviders(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliveryProvidersQuery(), ct));

    [HttpGet("summary")]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliverySummaryQuery(), ct));

    [HttpGet]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliveryOrdersQuery(status), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliveryOrderByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("restaurant.delivery.create")]
    public async Task<IActionResult> Create([FromBody] CreateDeliveryOrderCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPatch("{id:guid}/driver")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> AssignDriver(Guid id, [FromBody] AssignDriverReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AssignDriverToDeliveryCommand(id, req.DriverId), ct));

    [HttpPatch("{id:guid}/status")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ChangeDeliveryStatusCommand(id, req.Status), ct));

    /// <summary>GET /api/restaurant/delivery/track/{token} — anonymous customer tracking page,
    /// resolved purely from the unguessable token (mirrors the Careers/webhook anonymous pattern).</summary>
    [HttpGet("track/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> Track(string token, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliveryTrackingQuery(token), ct));

    public record AssignDriverReq(Guid DriverId);
    public record ChangeStatusReq(string Status);
}
