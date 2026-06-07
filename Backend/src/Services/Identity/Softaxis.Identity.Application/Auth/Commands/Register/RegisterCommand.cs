using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Auth.Commands.Register;

public sealed record RegisterCommand(
    string Email,
    string Username,
    string FirstName,
    string LastName,
    string Password,
    string ConfirmPassword
) : ICommand<UserDto>;
