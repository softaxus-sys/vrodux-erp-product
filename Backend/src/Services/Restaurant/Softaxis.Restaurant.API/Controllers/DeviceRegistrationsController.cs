using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Devices.Commands;
using Softaxis.Restaurant.Application.Devices.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Registered POS terminals/tablets — inventory/observability only (see DeviceRegistration's
/// own doc comment). Register/heartbeat are self-service (any authenticated user's browser announces
/// itself); listing/editing/removing devices is an admin action.</summary>
[ApiController][Route("api/restaurant/devices")][Authorize]
public sealed class DeviceRegistrationsController(ISender sender) : RestaurantControllerBase
{
    /// <summary>POST /api/restaurant/devices/register</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDeviceCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>POST /api/restaurant/devices/heartbeat</summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatDeviceCommand cmd, CancellationToken ct) =>
        NoContentOrError(await sender.Send(cmd, ct));

    /// <summary>GET /api/restaurant/devices?branchId=</summary>
    [HttpGet]
    [RequirePermission("restaurant.devices.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? branchId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeviceRegistrationsQuery(branchId), ct));

    /// <summary>PUT /api/restaurant/devices/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.devices.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDeviceRegistrationReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDeviceRegistrationCommand(id, req.DeviceName, req.BranchId, req.IsActive), ct));

    /// <summary>DELETE /api/restaurant/devices/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.devices.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDeviceRegistrationCommand(id), ct));

    public record UpdateDeviceRegistrationReq(string DeviceName, Guid? BranchId, bool IsActive);
}
