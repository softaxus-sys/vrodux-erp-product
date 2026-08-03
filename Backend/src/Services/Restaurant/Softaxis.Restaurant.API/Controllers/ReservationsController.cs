using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Reservations.Commands;
using Softaxis.Restaurant.Application.Reservations.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/reservations")][Authorize]
public sealed class ReservationsController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/reservations/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.reservations.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReservationsSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/reservations?date=yyyy-MM-dd</summary>
    [HttpGet]
    [RequirePermission("restaurant.reservations.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? date, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReservationsQuery(date), ct));

    /// <summary>POST /api/restaurant/reservations</summary>
    [HttpPost]
    [RequirePermission("restaurant.reservations.create")]
    public async Task<IActionResult> Create([FromBody] CreateReservationCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PATCH /api/restaurant/reservations/{id}/seat</summary>
    [HttpPatch("{id:guid}/seat")]
    [RequirePermission("restaurant.reservations.edit")]
    public async Task<IActionResult> Seat(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SeatReservationCommand(id), ct));

    /// <summary>PATCH /api/restaurant/reservations/{id}/cancel</summary>
    [HttpPatch("{id:guid}/cancel")]
    [RequirePermission("restaurant.reservations.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new CancelReservationCommand(id), ct));

    /// <summary>GET /api/restaurant/reservations/rules?branchId= — null if not configured yet.</summary>
    [HttpGet("rules")]
    [RequirePermission("restaurant.reservations.view")]
    public async Task<IActionResult> GetRule([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReservationRuleQuery(branchId), ct));

    /// <summary>PUT /api/restaurant/reservations/rules — create or update the branch's reservation policy.</summary>
    [HttpPut("rules")]
    [RequirePermission("restaurant.reservations.edit")]
    public async Task<IActionResult> UpsertRule([FromBody] UpsertReservationRuleCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
