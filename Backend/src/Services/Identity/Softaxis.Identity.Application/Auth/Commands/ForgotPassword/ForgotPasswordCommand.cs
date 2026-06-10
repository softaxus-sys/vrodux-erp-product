using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Auth.Commands.ForgotPassword;

public sealed record ForgotPasswordCommand(string Email) : ICommand;
