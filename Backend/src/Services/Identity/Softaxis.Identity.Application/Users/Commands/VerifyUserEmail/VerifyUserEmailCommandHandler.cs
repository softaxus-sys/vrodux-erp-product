using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.VerifyUserEmail;

public sealed class VerifyUserEmailCommandHandler(
    IUserRepository userRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow,
    ILogger<VerifyUserEmailCommandHandler> logger)
    : ICommandHandler<VerifyUserEmailCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(VerifyUserEmailCommand cmd, CancellationToken ct)
    {
        // The controller is [Authorize]-only, so the check lives here - same as ProvisionUser.
        // Either key is accepted for the same reason: whoever minted the login is the person who
        // gets asked why it cannot sign in, and on a site with no SMTP that is always HR.
        if (!currentUser.IsSuperAdmin
            && !currentUser.HasPermission("settings.users.edit")
            && !currentUser.HasPermission("hr.employees.create-login"))
            return Result.Failure<UserDto>(Error.Custom(
                "Permission.Denied", "You do not have permission to activate users."));

        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);

        // NotFound rather than Forbidden for another tenant's user - never confirm that an id
        // exists in a workspace the caller cannot see.
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure<UserDto>(Error.NotFoundById("User", cmd.UserId));

        // Already done is success, not an error: two admins clicking the same button, or one
        // clicking twice because the list had not refreshed, is not a failure worth reporting.
        if (user.EmailVerified && user.Status == UserStatus.Active)
            return Result.Success(UserDtoMapper.ToDto(user));

        // Deliberately narrow. Locked means five failed passwords, Inactive means an administrator
        // switched this person off - neither is "the verification email never arrived", and
        // quietly re-enabling them from a button labelled "Activate" would be the wrong thing to
        // do from the one place nobody expects it.
        if (user.Status is UserStatus.Locked or UserStatus.Inactive)
            return Result.Failure<UserDto>(Error.Custom(
                "User.Conflict",
                user.Status == UserStatus.Locked
                    ? "This account is locked after too many failed sign-in attempts. Reset the password instead."
                    : "This account has been disabled by an administrator. Re-enable it before confirming the address."));

        user.VerifyEmail();
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        logger.LogInformation(
            "User {UserId} was activated manually by {ActorId} - email confirmed without the link.",
            user.Id, currentUser.Id);

        return Result.Success(UserDtoMapper.ToDto(user));
    }
}
