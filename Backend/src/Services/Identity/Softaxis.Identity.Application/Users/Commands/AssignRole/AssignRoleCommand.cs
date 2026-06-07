using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.AssignRole;

public sealed record AssignRoleCommand(Guid UserId, Guid RoleId) : ICommand;
