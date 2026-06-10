using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.ForgotPassword;

public sealed class ForgotPasswordCommandHandler(
    IUserRepository  userRepo,
    IJwtTokenService jwtService,
    IEmailService    emailService,
    IUnitOfWork      uow)
    : ICommandHandler<ForgotPasswordCommand>
{
    private const int TokenExpiryMinutes = 60;

    public async Task<Result> Handle(ForgotPasswordCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);

        if (user is null)
            return Result.Failure(Error.Custom("Auth.ForgotPassword.NotFound",
                "No account found with that email address."));

        var rawToken   = jwtService.GenerateRefreshTokenRaw();
        var tokenHash  = jwtService.HashToken(rawToken);
        var expiry     = DateTime.UtcNow.AddMinutes(TokenExpiryMinutes);

        user.SetPasswordResetToken(tokenHash, expiry);
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        await emailService.SendPasswordResetEmailAsync(user.Email.Value, user.FullName, rawToken, ct);

        return Result.Success();
    }
}
