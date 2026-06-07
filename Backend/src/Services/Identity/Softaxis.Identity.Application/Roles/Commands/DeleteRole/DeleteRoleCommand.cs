using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Roles.Commands.DeleteRole;

public sealed record DeleteRoleCommand(Guid Id) : ICommand;
