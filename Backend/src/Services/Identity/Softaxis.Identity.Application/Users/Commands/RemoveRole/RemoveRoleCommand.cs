using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.RemoveRole;

public sealed record RemoveRoleCommand(Guid UserId, Guid RoleId) : ICommand;
