using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.ChangePassword;

public sealed record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword) : ICommand;
