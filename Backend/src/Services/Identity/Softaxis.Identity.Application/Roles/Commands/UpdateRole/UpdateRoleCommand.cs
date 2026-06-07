using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Roles.Commands.UpdateRole;

public sealed record UpdateRoleCommand(Guid Id, string Name, string Description) : ICommand<RoleDto>;
