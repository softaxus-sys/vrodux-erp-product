using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.EnableTwoFactor;

/// <summary>Confirm 2FA enrollment by supplying a current authenticator code. Returns backup codes.</summary>
public sealed record EnableTwoFactorCommand(Guid UserId, string Code) : ICommand<TwoFactorEnableResultDto>;
