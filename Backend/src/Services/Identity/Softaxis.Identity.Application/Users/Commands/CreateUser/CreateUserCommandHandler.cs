using Microsoft.Extensions.Logging;
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
    IJwtTokenService    jwtService,
    IEmailService       emailService,
    ILogger<CreateUserCommandHandler> logger,
    IUnitOfWork         uow)
    : ICommandHandler<CreateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        // ── Plan limit check ──────────────────────────────────────────────────
        // Shared with ProvisionUser: both mint a login and both consume a seat.
        if (await PlanSeatGuard.CheckAsync(userRepo, currentUser, tenantContext, ct) is { } seatError)
            return Result.Failure<UserDto>(seatError);

        if (await userRepo.EmailExistsAsync(cmd.Email, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Email.Taken", "Email is already registered."));

        if (await userRepo.UsernameExistsAsync(cmd.Username, ct))
            return Result.Failure<UserDto>(Error.Custom("User.Username.Taken", "Username is already taken."));

        var hash   = passwordHasher.Hash(cmd.Password);
        var result = User.Create(cmd.Email, cmd.Username, cmd.FirstName, cmd.LastName, hash);
        if (result.IsFailure) return Result.Failure<UserDto>(result.Error);

        var user = result.Value;
        // NOTE: do NOT pre-verify. The user stays in PendingVerification until they click the
        // verification link we email below; LoginCommandHandler blocks login until then.

        // Assign tenant if the caller is scoped to one
        if (!currentUser.IsSuperAdmin && tenantContext.TenantId.HasValue)
            user.SetTenant(tenantContext.TenantId.Value);

        foreach (var roleId in cmd.RoleIds.Distinct())
        {
            var role = await roleRepo.GetByIdAsync(roleId, ct);
            if (role is not null) user.AssignRole(roleId);
        }

        // Issue a single-use email-verification token (48h) and email the link.
        var rawToken = jwtService.GenerateRefreshTokenRaw();
        user.SetEmailVerificationToken(jwtService.HashToken(rawToken), DateTime.UtcNow.AddHours(48));

        userRepo.Add(user);
        auditRepo.Add(new AuditLog(currentUser.Id, "CREATE_USER", "User", user.Id.ToString(), null, null, null, null, true, currentUser.TenantId));
        await uow.SaveChangesAsync(ct);

        // Best-effort send — never fail user creation if SMTP is down (link is also logged server-side).
        try
        {
            await emailService.SendEmailVerificationAsync(user.Email.Value, user.FullName, rawToken, ct);
            logger.LogInformation("Verification email dispatched for new user {Email} (Id {UserId}).", user.Email.Value, user.Id);
        }
        catch (Exception ex)
        {
            // Delivery failure is non-fatal (admin can resend), but it MUST be visible in logs —
            // a silent swallow here is why undelivered verification emails go unnoticed.
            logger.LogError(ex, "Failed to send verification email to {Email} (Id {UserId}). " +
                "Check the Email:* / Email__* SMTP settings for this environment.", user.Email.Value, user.Id);
        }

        // Reload with full role/permission navigation so the DTO is complete.
        var created = await userRepo.GetByIdAsync(user.Id, ct);
        return Result.Success(UserDtoMapper.ToDto(created ?? user));
    }
}
