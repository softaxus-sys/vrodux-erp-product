using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.RevokeToken;

public sealed record RevokeTokenCommand(string Token, string? IpAddress = null) : ICommand;
