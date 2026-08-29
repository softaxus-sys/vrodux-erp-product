using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Domain.ValueObjects;

namespace Softaxis.Identity.Application.Users.Commands.ChangeUserEmail;

public sealed class ChangeUserEmailCommandHandler(
    IUserRepository         userRepo,
    ITenantRepository       tenantRepo,
    IRefreshTokenRepository refreshRepo,
    IAuditLogRepository     auditRepo,
    IPasswordHasher         passwordHasher,
    IJwtTokenService        jwt,
    IEmailService           email,
    ICurrentUser            currentUser,
    ITenantContext          tenantContext,
    ILogger<ChangeUserEmailCommandHandler> logger,
    IUnitOfWork             uow)
    : ICommandHandler<ChangeUserEmailCommand, ChangeEmailResultDto>
{
    public async Task<Result<ChangeEmailResultDto>> Handle(ChangeUserEmailCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure<ChangeEmailResultDto>(Error.NotFoundById("User", cmd.UserId));

        var isSelf = currentUser.Id == cmd.UserId;

        // UsersController is [Authorize]-only, so the two cases enforce their own rules here.
        if (isSelf)
        {
            // The password is what proves the person at the keyboard is the account holder. Without
            // it, a session someone walked away from is enough to move the recovery address.
            if (string.IsNullOrWhiteSpace(cmd.CurrentPassword))
                return Result.Failure<ChangeEmailResultDto>(Error.Custom(
                    "User.Password.Required", "Enter your current password to change your email address."));

            if (!passwordHasher.Verify(cmd.CurrentPassword, user.PasswordHash))
                return Result.Failure<ChangeEmailResultDto>(Error.Custom(
                    "User.Password.Invalid", "Current password is incorrect."));
        }
        else if (!currentUser.IsSuperAdmin && !currentUser.HasPermission("settings.users.edit"))
        {
            return Result.Failure<ChangeEmailResultDto>(Error.Custom(
                "Permission.Denied", "You do not have permission to change another user's email address."));
        }

        var emailResult = Email.Create(cmd.NewEmail);
        if (emailResult.IsFailure) return Result.Failure<ChangeEmailResultDto>(emailResult.Error);

        var newEmail = emailResult.Value;
        var oldEmail = user.Email.Value;

        if (string.Equals(oldEmail, newEmail.Value, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ChangeEmailResultDto>(Error.Custom(
                "User.Email.Unchanged", "That is already this account's email address."));

        // Email identifies a login across the WHOLE platform — sign-in resolves an account by
        // address alone, with no workspace to disambiguate — so this check is deliberately not
        // tenant-scoped, and the message says so: the conflicting account may be one the caller
        // cannot see. Same wording as ProvisionUser, for the same reason.
        if (await userRepo.EmailExistsAsync(newEmail.Value, ct))
            return Result.Failure<ChangeEmailResultDto>(Error.Custom("User.Email.Taken",
                "This email already has a Vrodux login, in this or another workspace. An address can only belong to one login."));

        // A user moving their own address must prove they own the new one before it can sign them
        // in. An administrator making the change is the verification instead — the same call
        // ProvisionUser makes — so the account keeps working and cannot be locked out by a bounced
        // message the administrator never sees.
        var requireVerification = isSelf;

        user.ChangeEmail(newEmail, requireVerification);

        string? verificationToken = null;
        if (requireVerification)
        {
            verificationToken = jwt.GenerateRefreshTokenRaw();
            user.SetEmailVerificationToken(jwt.HashToken(verificationToken), DateTime.UtcNow.AddHours(48));
        }

        userRepo.Update(user);

        // The account's identity just changed, so every session established under the old one ends.
        // That includes the caller's own when this is a self-change — deliberate: they re-sign in
        // with the address they just proved.
        await refreshRepo.RevokeAllForUserAsync(user.Id, ct);

        auditRepo.Add(new AuditLog(
            currentUser.Id, "CHANGE_USER_EMAIL", "User", user.Id.ToString(),
            oldEmail, newEmail.Value, null, null, true, currentUser.TenantId));

        await uow.SaveChangesAsync(ct);

        // Sent after the commit — a mail for a change that failed to save would be a lie.
        var sent = false;
        string? error = null;
        try
        {
            var tenant    = user.TenantId is null ? null : await tenantRepo.GetByIdAsync(user.TenantId.Value, ct);
            var workspace = tenant?.Name ?? "Vrodux ERP";

            if (requireVerification)
            {
                await email.SendEmailVerificationAsync(newEmail.Value, user.FullName, verificationToken!, ct);
                sent = true;
            }

            // Always warn the address being left behind: if this change was not made by the owner,
            // that is the only channel they still control.
            await email.SendEmailChangedNoticeAsync(oldEmail, user.FullName, newEmail.Value, workspace, ct);
            if (!requireVerification) sent = true;
        }
        catch (Exception ex)
        {
            // Never fail a committed change over a mail problem — the caller is told instead, and
            // an unverified account can always use the anonymous resend-verification endpoint.
            logger.LogWarning(ex, "Email-change notification failed for user {UserId}", user.Id);
            error = ex.Message;
        }

        return Result.Success(new ChangeEmailResultDto(
            user.Id, newEmail.Value, requireVerification, sent, error));
    }
}
