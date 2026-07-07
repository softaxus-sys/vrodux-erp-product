using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.SetupTwoFactor;

/// <summary>Begin 2FA enrollment for the current user — generates (but does not yet enable) a secret.</summary>
public sealed record SetupTwoFactorCommand(Guid UserId) : ICommand<TwoFactorSetupDto>;
