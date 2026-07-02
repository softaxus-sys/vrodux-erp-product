using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.API.Models;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Auth.Commands.ForgotPassword;
using Softaxis.Identity.Application.Auth.Commands.Login;
using Softaxis.Identity.Application.Auth.Commands.RefreshToken;
using Softaxis.Identity.Application.Auth.Commands.Register;
using Softaxis.Identity.Application.Auth.Commands.ResetPassword;
using Softaxis.Identity.Application.Auth.Commands.RevokeToken;
using Softaxis.Identity.Application.Auth.Commands.VerifyEmail;
using Softaxis.Identity.Application.Auth.Commands.ResendVerification;
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

    /// <summary>Request a password-reset email (anonymous).</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("forgot_password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req, CancellationToken ct)
    {
        var result = await Sender.Send(new ForgotPasswordCommand(req.Email), ct);
        return HandleResult(result);
    }

    /// <summary>Reset password using the token from the reset email.</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken ct)
    {
        var result = await Sender.Send(new ResetPasswordCommand(req.Email, req.Token, req.NewPassword), ct);
        return HandleResult(result);
    }

    /// <summary>Verify an email address using the token from the verification email.</summary>
    [HttpPost("verify-email")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new VerifyEmailCommand(req.Email, req.Token), ct));

    /// <summary>Re-send the verification link for an unverified account.</summary>
    [HttpPost("resend-verification")]
    [AllowAnonymous]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("forgot_password")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ResendVerificationCommand(req.Email), ct));

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

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(
    string Email,
    string Token,
    string NewPassword);

public sealed record VerifyEmailRequest(string Email, string Token);
public sealed record ResendVerificationRequest(string Email);
