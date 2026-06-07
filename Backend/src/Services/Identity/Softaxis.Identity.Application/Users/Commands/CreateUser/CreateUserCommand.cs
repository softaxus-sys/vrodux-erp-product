using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.CreateUser;

public sealed record CreateUserCommand(
    string       Email,
    string       Username,
    string       FirstName,
    string       LastName,
    string       Password,
    List<Guid>   RoleIds
) : ICommand<UserDto>;
