using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.ResetPassword;

public sealed class ResetPasswordCommandHandler(
    IUserRepository         userRepo,
    IJwtTokenService        jwtService,
    IPasswordHasher         passwordHasher,
    IRefreshTokenRepository refreshRepo,
    IAuditLogRepository     auditRepo,
    IUnitOfWork             uow)
    : ICommandHandler<ResetPasswordCommand>
{
    /// <summary>
    /// A reset can only ever change the password of the account the token was issued for.
    /// The address in the link selects the account, and the token is then checked against THAT
    /// account's stored hash — so pointing a valid token at someone else's address simply fails,
    /// and the failure is indistinguishable from an expired one.
    /// </summary>
    public async Task<Result> Handle(ResetPasswordCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);

        // One message for every failure — unknown address, wrong token, expired token, already
        // used. Distinguishing them would turn this endpoint into the account oracle that
        // forgot-password no longer is.
        var invalid = Error.Custom("Auth.ResetPassword.Invalid", "Invalid or expired reset link. Request a new one.");

        if (user is null) return Result.Failure(invalid);

        if (!user.IsPasswordResetTokenValid(jwtService.HashToken(cmd.Token)))
            return Result.Failure(invalid);

        user.ChangePassword(passwordHasher.Hash(cmd.NewPassword));
        user.ClearPasswordResetToken();

        // Reading the link proves control of the address, which is exactly what the verification
        // mail proves. Without this an admin-created account could reset its password and still be
        // refused at login by the verification gate, with nothing on screen explaining why.
        user.ConfirmEmailViaPasswordReset();

        // Locked out by failed attempts is the usual reason someone resets — leaving the lock in
        // place would make the reset appear not to work.
        if (user.IsLocked) user.Unlock();

        userRepo.Update(user);

        // Whoever prompted this reset may already hold a session. A password change that leaves
        // those alive does not actually take the account back.
        await refreshRepo.RevokeAllForUserAsync(user.Id, ct);

        auditRepo.Add(new Domain.Entities.AuditLog(
            user.Id, "PASSWORD_RESET", "User", user.Id.ToString(),
            null, null, null, null, true, user.TenantId));

        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
