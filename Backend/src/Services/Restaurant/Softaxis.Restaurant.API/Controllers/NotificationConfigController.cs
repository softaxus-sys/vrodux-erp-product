using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Notifications.Commands;
using Softaxis.Restaurant.Application.Notifications.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>SMS/WhatsApp provider (Twilio) configuration — the credentials digital receipts
/// (see OrdersController.SendReceipt) send through.</summary>
[ApiController][Route("api/restaurant/notifications")][Authorize]
public sealed class NotificationConfigController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/notifications/{channel} — channel is "sms" or "whatsapp".</summary>
    [HttpGet("{channel}")]
    [RequirePermission("restaurant.notifications.view")]
    public async Task<IActionResult> GetConfig(string channel, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetNotificationProviderConfigQuery(channel), ct));

    /// <summary>PUT /api/restaurant/notifications — configure a channel's provider credentials.</summary>
    [HttpPut]
    [RequirePermission("restaurant.notifications.edit")]
    public async Task<IActionResult> UpsertConfig([FromBody] UpsertNotificationProviderConfigCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
