using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.AdminResetPassword;

/// <summary>
/// Admin-level password reset that does NOT require the user's current password.
/// Use for administrators resetting another user's password.
/// </summary>
public sealed record AdminResetPasswordCommand(Guid UserId, string NewPassword) : ICommand;
