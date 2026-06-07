using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.API.Models;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Auth.Commands.Login;
using Softaxis.Identity.Application.Auth.Commands.RefreshToken;
using Softaxis.Identity.Application.Auth.Commands.Register;
using Softaxis.Identity.Application.Auth.Commands.RevokeToken;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Application.Users.Commands.ChangePassword;
using Softaxis.Identity.Application.Users.Commands.UpdateUser;
using Softaxis.Identity.Application.Users.Queries.GetUserById;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Authentication — login, register, token refresh, logout, and profile management.
/// </summary>
[Tags("Auth")]
public sealed class AuthController(ISender sender, ICurrentUser currentUser) : BaseApiController(sender)
{
    /// <summary>Register a new user account.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), 201)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), 400)]
    public async Task<IActionResult> Register([FromBody] RegisterCommand command, CancellationToken ct)
    {
        var result = await Sender.Send(command, ct);
        return HandleResult(result, 201);
    }

    /// <summary>Login with email + password. Returns access and refresh tokens.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<AuthTokenDto>), 200)]
    [ProducesResponseType(typeof(ApiResponse<AuthTokenDto>), 400)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var command = new LoginCommand(request.Email, request.Password, HttpContext.Connection.RemoteIpAddress?.ToString());
        var result  = await Sender.Send(command, ct);
        return HandleResult(result);
    }

    /// <summary>Refresh an expired access token using a valid refresh token.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<AuthTokenDto>), 200)]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var command = new RefreshTokenCommand(request.Token, HttpContext.Connection.RemoteIpAddress?.ToString());
        return HandleResult(await Sender.Send(command, ct));
    }

    /// <summary>Revoke a refresh token (logout from current device).</summary>
    [HttpPost("revoke")]
    [Authorize]
    public async Task<IActionResult> Revoke([FromBody] RevokeRequest request, CancellationToken ct)
    {
        var command = new RevokeTokenCommand(request.Token, HttpContext.Connection.RemoteIpAddress?.ToString());
        return HandleResult(await Sender.Send(command, ct));
    }

    // ── /me ───────────────────────────────────────────────────────────────────

    /// <summary>Get the current authenticated user's profile.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), 200)]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Unauthorized();

        return HandleResult(await Sender.Send(new GetUserByIdQuery(currentUser.Id.Value), ct));
    }

    /// <summary>Update the current authenticated user's own profile.</summary>
    [HttpPut("me")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), 200)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateMeRequest req, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Unauthorized();

        return HandleResult(await Sender.Send(
            new UpdateUserCommand(currentUser.Id.Value, req.FirstName, req.LastName, req.PhoneNumber, req.AvatarUrl), ct));
    }

    /// <summary>Change the current authenticated user's own password.</summary>
    [HttpPost("me/change-password")]
    [Authorize]
    public async Task<IActionResult> ChangeMyPassword([FromBody] ChangeMyPasswordRequest req, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Unauthorized();

        return HandleResult(await Sender.Send(
            new ChangePasswordCommand(currentUser.Id.Value, req.CurrentPassword, req.NewPassword), ct));
    }
}

// ── Request models ────────────────────────────────────────────────────────────

public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshRequest(string Token);
public sealed record RevokeRequest(string Token);

public sealed record UpdateMeRequest(
    string  FirstName,
    string  LastName,
    string? PhoneNumber,
    string? AvatarUrl);

public sealed record ChangeMyPasswordRequest(
    string CurrentPassword,
    string NewPassword);
