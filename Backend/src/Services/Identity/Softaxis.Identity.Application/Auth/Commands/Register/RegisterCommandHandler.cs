using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.Register;

public sealed class RegisterCommandHandler(
    IUserRepository     userRepo,
    IPasswordHasher     passwordHasher,
    IAuditLogRepository auditRepo,
    IUnitOfWork         uow)
    : ICommandHandler<RegisterCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        if (await userRepo.EmailExistsAsync(cmd.Email, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Email.Taken", "This email is already registered."));

        if (await userRepo.UsernameExistsAsync(cmd.Username, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Username.Taken", "This username is already taken."));

        var hash       = passwordHasher.Hash(cmd.Password);
        var userResult = User.Create(cmd.Email, cmd.Username, cmd.FirstName, cmd.LastName, hash);

        if (userResult.IsFailure)
            return Result.Failure<UserDto>(userResult.Error);

        var user = userResult.Value;
        userRepo.Add(user);
        auditRepo.Add(new AuditLog(user.Id, "REGISTER", "User", user.Id.ToString(), null, null, null, null, true, user.TenantId));

        await uow.SaveChangesAsync(ct);

        return Result.Success(ToDto(user));
    }

    private static UserDto ToDto(User u) =>
        new(u.Id, u.Email.Value, u.Username, u.FirstName, u.LastName,
            u.FullName, u.Status.ToString(), u.EmailVerified,
            u.AvatarUrl, u.PhoneNumber, u.LastLoginAt, u.CreatedAt, [], []);
}
