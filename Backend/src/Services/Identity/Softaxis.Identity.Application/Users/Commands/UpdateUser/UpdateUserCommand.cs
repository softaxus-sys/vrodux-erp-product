using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.UpdateUser;

public sealed record UpdateUserCommand(
    Guid    Id,
    string  FirstName,
    string  LastName,
    string? PhoneNumber,
    string? AvatarUrl
) : ICommand<UserDto>;
