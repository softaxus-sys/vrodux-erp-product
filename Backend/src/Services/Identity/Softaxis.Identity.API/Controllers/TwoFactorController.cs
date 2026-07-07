using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.API.Models;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Application.Users.Commands.DisableTwoFactor;
using Softaxis.Identity.Application.Users.Commands.EnableTwoFactor;
using Softaxis.Identity.Application.Users.Commands.SetupTwoFactor;
using Softaxis.Identity.Application.Users.Queries.GetTwoFactorStatus;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Self-service two-factor authentication (TOTP / authenticator app) for the current user.
/// Any authenticated user can enable/disable their own 2FA — used by super-admins and tenant users alike.
/// </summary>
[Tags("Two-Factor Auth")]
[Route("api/account/2fa")]
[Authorize]
public sealed class TwoFactorController(ISender sender, ICurrentUser currentUser) : BaseApiController(sender)
{
    /// <summary>Whether 2FA is enabled for the current user and how many backup codes remain.</summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(ApiResponse<TwoFactorStatusDto>), 200)]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(new GetTwoFactorStatusQuery(currentUser.Id.Value), ct));
    }

    /// <summary>Begin enrollment — returns a secret + QR to scan in an authenticator app.</summary>
    [HttpPost("setup")]
    [ProducesResponseType(typeof(ApiResponse<TwoFactorSetupDto>), 200)]
    public async Task<IActionResult> Setup(CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(new SetupTwoFactorCommand(currentUser.Id.Value), ct));
    }

    /// <summary>Confirm enrollment with a current code. Returns one-time backup codes (shown once).</summary>
    [HttpPost("enable")]
    [ProducesResponseType(typeof(ApiResponse<TwoFactorEnableResultDto>), 200)]
    public async Task<IActionResult> Enable([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(new EnableTwoFactorCommand(currentUser.Id.Value, request.Code), ct));
    }

    /// <summary>Turn off 2FA. Requires a current authenticator or backup code.</summary>
    [HttpPost("disable")]
    public async Task<IActionResult> Disable([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return HandleResult(await Sender.Send(new DisableTwoFactorCommand(currentUser.Id.Value, request.Code), ct));
    }
}

public sealed record TwoFactorCodeRequest(string Code);
