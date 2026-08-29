using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.ForgotPassword;

public sealed class ForgotPasswordCommandHandler(
    IUserRepository  userRepo,
    IJwtTokenService jwtService,
    IEmailService    emailService,
    ILogger<ForgotPasswordCommandHandler> logger,
    IUnitOfWork      uow)
    : ICommandHandler<ForgotPasswordCommand>
{
    private const int TokenExpiryMinutes = 60;

    /// <summary>
    /// Enumeration-safe: this endpoint is anonymous, so it answers identically whether or not the
    /// address has an account. It used to return 404 "No account found with that email address.",
    /// which let anyone test which addresses hold a Vrodux login — the same reasoning
    /// <c>ResendVerificationCommandHandler</c> was already built on.
    /// </summary>
    public async Task<Result> Handle(ForgotPasswordCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);

        // No account (or a soft-deleted one — the repository filters those out): say nothing, do
        // nothing. The caller gets the same success the real path returns.
        if (user is null)
        {
            logger.LogInformation("Password reset requested for an unknown address.");
            return Result.Success();
        }

        var rawToken  = jwtService.GenerateRefreshTokenRaw();
        var tokenHash = jwtService.HashToken(rawToken);

        user.SetPasswordResetToken(tokenHash, DateTime.UtcNow.AddMinutes(TokenExpiryMinutes));
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        // The link goes to the address ON THE ACCOUNT, never to the address that was typed. They
        // are the same string here, but reading it off the entity is what guarantees a reset can
        // only ever reach the account's own owner.
        try
        {
            await emailService.SendPasswordResetEmailAsync(user.Email.Value, user.FullName, rawToken, ct);
        }
        catch (Exception ex)
        {
            // The token is already saved and a retry simply issues a new one, so a mail outage must
            // not surface as a 500 on an anonymous endpoint — which would also reveal that the
            // address exists, undoing the check above.
            logger.LogError(ex, "Password reset email failed to send for user {UserId}", user.Id);
        }

        return Result.Success();
    }
}
