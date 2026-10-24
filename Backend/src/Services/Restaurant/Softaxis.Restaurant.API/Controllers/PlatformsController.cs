using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Platforms;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Online ordering platform connections (Foodpanda) and the actions on their orders.</summary>
[ApiController][Route("api/restaurant/platforms")][Authorize]
public sealed class PlatformsController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.integrations.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPlatformConnectionsQuery(), ct));

    [HttpPost]
    [RequirePermission("restaurant.integrations.edit")]
    public async Task<IActionResult> Create([FromBody] ConnectionReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(r.ToCommand(null), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.integrations.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ConnectionReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(r.ToCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.integrations.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePlatformConnectionCommand(id), ct));

    [HttpPost("{id:guid}/test")]
    [RequirePermission("restaurant.integrations.edit")]
    public async Task<IActionResult> Test(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new TestPlatformConnectionCommand(id), ct));

    // ── Actions on an order that came from a platform — till staff, not integration admins ──
    [HttpPost("orders/{orderId:guid}/accept")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Accept(Guid orderId, [FromBody] AcceptReq? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AcceptPlatformOrderCommand(orderId, r?.PrepMinutes), ct));

    [HttpPost("orders/{orderId:guid}/reject")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> Reject(Guid orderId, [FromBody] RejectReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new RejectPlatformOrderCommand(orderId, r.Reason, r.Message), ct));

    [HttpPost("orders/{orderId:guid}/handover")]
    [RequirePermission("restaurant.orders.edit")]
    public async Task<IActionResult> HandOver(Guid orderId, CancellationToken ct) =>
        OkOrError(await sender.Send(new HandOverPlatformOrderCommand(orderId), ct));

    public sealed record ConnectionReq(string? Platform, string? Environment, Guid BranchId, string RemoteId, string? Username,
        string? Password, string? PluginSecret, bool AutoAccept, int? DefaultPrepMinutes, bool? IsEnabled)
    {
        public SavePlatformConnectionCommand ToCommand(Guid? id) => new(id, Platform ?? "foodpanda", Environment ?? "sandbox",
            BranchId, RemoteId ?? "", Username, Password, PluginSecret, AutoAccept, DefaultPrepMinutes ?? 20, IsEnabled ?? true);
    }
    public sealed record AcceptReq(int? PrepMinutes);
    public sealed record RejectReq(string Reason, string? Message);
}

/// <summary>
/// The "POS plugin" address Foodpanda (Delivery Hero) calls. Anonymous: the workspace and branch are
/// identified by the unguessable key in the URL, and the call by the plugin secret.
/// </summary>
[ApiController][Route("api/restaurant/platforms/foodpanda/{inboundKey}")][AllowAnonymous]
public sealed class FoodpandaPluginController(ISender sender) : RestaurantControllerBase
{
    /// <summary>POST …/order/{remoteId} — a new order.</summary>
    [HttpPost("order/{remoteId}")]
    public async Task<IActionResult> Order(string inboundKey, string remoteId, CancellationToken ct)
    {
        var body = await new StreamReader(Request.Body).ReadToEndAsync(ct);
        var result = await sender.Send(new IngestPlatformOrderCommand(inboundKey, remoteId, body, Request.Headers.Authorization), ct);
        return result.IsFailure ? OkOrError(result)
            : Ok(new { remoteResponse = new { remoteOrderId = result.Value.OrderId.ToString() } });
    }

    /// <summary>PUT …/remoteId/{remoteId}/remoteOrder/{remoteOrderId}/posOrderStatus — e.g. cancelled.</summary>
    [HttpPut("remoteId/{remoteId}/remoteOrder/{remoteOrderId}/posOrderStatus")]
    public async Task<IActionResult> Status(string inboundKey, string remoteId, string remoteOrderId, CancellationToken ct)
    {
        var body = await new StreamReader(Request.Body).ReadToEndAsync(ct);
        return NoContentOrError(await sender.Send(
            new PlatformOrderStatusCommand(inboundKey, remoteId, remoteOrderId, body, Request.Headers.Authorization), ct));
    }
}
