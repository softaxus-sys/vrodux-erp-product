using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.RefreshToken;

public sealed record RefreshTokenCommand(string Token, string? IpAddress = null) : ICommand<AuthTokenDto>;
