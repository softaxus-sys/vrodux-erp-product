using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.DisableTwoFactor;

/// <summary>Turn off 2FA. Requires a current authenticator or backup code to prove possession.</summary>
public sealed record DisableTwoFactorCommand(Guid UserId, string Code) : ICommand;
