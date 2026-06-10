using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.ResetPassword;

public sealed record ResetPasswordCommand(
    string Email,
    string Token,
    string NewPassword) : ICommand;
