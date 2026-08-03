using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Waitlist.Commands;
using Softaxis.Restaurant.Application.Waitlist.Queries;

namespace Softaxis.Restaurant.API.Controllers;

// No dedicated `restaurant.waitlist` permission group exists — walk-in waitlisting is a
// sub-feature of table management, so it gates on the existing `restaurant.tables.*` keys
// (same nearest-seeded-key convention used for GRN/PurchaseReturns/DeliveryChallans elsewhere).
[ApiController][Route("api/restaurant/waitlist")][Authorize]
public sealed class WaitlistController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/waitlist/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaitlistSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/waitlist?status=</summary>
    [HttpGet]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWaitlistQuery(status), ct));

    /// <summary>POST /api/restaurant/waitlist</summary>
    [HttpPost]
    [RequirePermission("restaurant.tables.create")]
    public async Task<IActionResult> Create([FromBody] CreateWaitlistEntryCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PATCH /api/restaurant/waitlist/{id}/seat</summary>
    [HttpPatch("{id:guid}/seat")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Seat(Guid id, [FromBody] SeatReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SeatWaitlistEntryCommand(id, req.TableId), ct));

    /// <summary>PATCH /api/restaurant/waitlist/{id}/cancel</summary>
    [HttpPatch("{id:guid}/cancel")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new CancelWaitlistEntryCommand(id), ct));

    /// <summary>PATCH /api/restaurant/waitlist/{id}/no-show</summary>
    [HttpPatch("{id:guid}/no-show")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> NoShow(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkWaitlistNoShowCommand(id), ct));

    public record SeatReq(Guid TableId);
}
