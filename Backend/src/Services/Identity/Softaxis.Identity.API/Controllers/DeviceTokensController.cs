using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DeviceTokens.Commands;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Mobile push-token registration for the current user. No module permission: every action is
/// scoped to the caller's own device, exactly like <c>TwoFactorController</c>.
/// </summary>
[Tags("Device Tokens")]
[Route("api/account/device-tokens")]
[Authorize]
public sealed class DeviceTokensController(ISender sender, ICurrentUser currentUser) : BaseApiController(sender)
{
    /// <summary>Register (or refresh) this device's Expo push token.</summary>
    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterDeviceTokenRequest request, CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(
            new RegisterDeviceTokenCommand(currentUser.Id.Value, request.ExpoPushToken, request.Platform, request.DeviceName), ct));
    }

    /// <summary>Stop sending push to this device — called best-effort on logout. POST rather than
    /// DELETE-with-body: an Expo token contains characters (<c>[</c>, <c>]</c>) that don't sit
    /// cleanly in a URL path or query string.</summary>
    [HttpPost("unregister")]
    public async Task<IActionResult> Unregister([FromBody] UnregisterDeviceTokenRequest request, CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(
            new UnregisterDeviceTokenCommand(currentUser.Id.Value, request.ExpoPushToken), ct));
    }
}

public sealed record RegisterDeviceTokenRequest(string ExpoPushToken, string Platform, string? DeviceName);
public sealed record UnregisterDeviceTokenRequest(string ExpoPushToken);
