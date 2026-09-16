using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.Login;

public sealed record LoginCommand(
    string Email,
    string Password,
    string? IpAddress = null,
    string? DeviceId = null,
    string? DeviceName = null,
    string? Platform = null
) : ICommand<AuthTokenDto>;
