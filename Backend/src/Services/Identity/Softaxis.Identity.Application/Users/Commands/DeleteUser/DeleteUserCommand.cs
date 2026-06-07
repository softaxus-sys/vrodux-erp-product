using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.DeleteUser;

public sealed record DeleteUserCommand(Guid Id) : ICommand;
