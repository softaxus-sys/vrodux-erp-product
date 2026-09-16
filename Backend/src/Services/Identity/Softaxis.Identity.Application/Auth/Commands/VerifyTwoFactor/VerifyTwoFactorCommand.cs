using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.VerifyTwoFactor;

public sealed record VerifyTwoFactorCommand(
    string  MfaToken,
    string  Code,
    string? IpAddress = null,
    string? DeviceId = null,
    string? DeviceName = null,
    string? Platform = null
) : ICommand<AuthTokenDto>;
