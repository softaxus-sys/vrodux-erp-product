using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.CreateUser;

public sealed class CreateUserCommandHandler(
    IUserRepository     userRepo,
    IRoleRepository     roleRepo,
    IPasswordHasher     passwordHasher,
    IAuditLogRepository auditRepo,
    ICurrentUser        currentUser,
    ITenantContext      tenantContext,
    IUnitOfWork         uow)
    : ICommandHandler<CreateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        // ── Plan limit check ──────────────────────────────────────────────────
        if (!currentUser.IsSuperAdmin &&
            tenantContext.IsResolved &&
            tenantContext.TenantId.HasValue &&
            tenantContext.Limits is { MaxUsers: > 0 } limits)
        {
            var count = await userRepo.CountByTenantAsync(tenantContext.TenantId.Value, ct);
            if (count >= limits.MaxUsers)
                return Result.Failure<UserDto>(Error.Custom(
                    "Plan.UserLimitReached",
                    $"Your {tenantContext.Plan} plan allows a maximum of {limits.MaxUsers} users. " +
                    "Please upgrade to add more users."));
        }

        if (await userRepo.EmailExistsAsync(cmd.Email, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Email.Taken", "Email is already registered."));

        if (await userRepo.UsernameExistsAsync(cmd.Username, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Username.Taken", "Username is already taken."));

        var hash   = passwordHasher.Hash(cmd.Password);
        var result = User.Create(cmd.Email, cmd.Username, cmd.FirstName, cmd.LastName, hash);
        if (result.IsFailure) return Result.Failure<UserDto>(result.Error);

        var user = result.Value;
        user.VerifyEmail(); // Admin-created users are pre-verified

        // Assign tenant if the caller is scoped to one
        if (!currentUser.IsSuperAdmin && tenantContext.TenantId.HasValue)
            user.SetTenant(tenantContext.TenantId.Value);

        foreach (var roleId in cmd.RoleIds.Distinct())
        {
            var role = await roleRepo.GetByIdAsync(roleId, ct);
            if (role is not null) user.AssignRole(roleId);
        }

        userRepo.Add(user);
        auditRepo.Add(new AuditLog(currentUser.Id, "CREATE_USER", "User", user.Id.ToString(), null, null, null, null, true, currentUser.TenantId));
        await uow.SaveChangesAsync(ct);

        // Reload with full role/permission navigation so the DTO is complete.
        var created = await userRepo.GetByIdAsync(user.Id, ct);
        return Result.Success(UserDtoMapper.ToDto(created ?? user));
    }
}
