using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.PublicOrdering.Commands;
using Softaxis.Restaurant.Application.PublicOrdering.Dtos;
using Softaxis.Restaurant.Application.PublicOrdering.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>
/// Anonymous guest-facing endpoints for QR-table ordering and self-ordering kiosks — no [Authorize],
/// tenant resolved entirely from the table's unguessable QrCode (same posture as this codebase's
/// Careers/webhook anonymous endpoints). Deliberately one controller, not gated by [RequirePermission]
/// at all, since there's no authenticated caller to check permissions against.
/// </summary>
[ApiController][Route("api/restaurant")][AllowAnonymous]
public sealed class PublicOrderingController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/public-menu/{qrCode}</summary>
    [HttpGet("public-menu/{qrCode}")]
    public async Task<IActionResult> GetMenu(string qrCode, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPublicMenuQuery(qrCode), ct));

    /// <summary>POST /api/restaurant/public-orders</summary>
    [HttpPost("public-orders")]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PlacePublicOrderCommand(
            req.QrCode, req.Channel, req.Notes, req.GuestDeviceToken,
            req.Items.Select(i => new PublicOrderLineInput(i.MenuItemId, i.Quantity, i.Modifiers)).ToList()), ct));

    public record PublicOrderLineReq(Guid MenuItemId, int Quantity, string? Modifiers);
    public record PlaceOrderReq(string QrCode, string? Channel, string? Notes, string GuestDeviceToken, List<PublicOrderLineReq> Items);
}
