using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.RefreshToken;

public sealed record RefreshTokenCommand(
    string Token,
    string? IpAddress = null,
    // Optional -- the handler falls back to whatever the token being rotated already carried, so a
    // client that only sends device info at login (not on every refresh) doesn't lose its label.
    string? DeviceId = null,
    string? DeviceName = null,
    string? Platform = null
) : ICommand<AuthTokenDto>;
