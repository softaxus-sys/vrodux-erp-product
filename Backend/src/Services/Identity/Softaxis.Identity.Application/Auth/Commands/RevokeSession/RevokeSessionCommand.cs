using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.RevokeSession;

/// <summary>Revoke one of the caller's own active sessions by id (the "manage my devices" flow --
/// distinct from POST /revoke, which revokes by presenting the raw token itself, i.e. "log out
/// this device, right now, from this device").</summary>
public sealed record RevokeSessionCommand(Guid UserId, Guid SessionId) : ICommand;
