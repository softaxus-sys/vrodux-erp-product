using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.ResendVerification;

public sealed class ResendVerificationCommandHandler(
    IUserRepository  userRepo,
    IJwtTokenService jwtService,
    IEmailService    emailService,
    IUnitOfWork      uow)
    : ICommandHandler<ResendVerificationCommand>
{
    public async Task<Result> Handle(ResendVerificationCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);
        // Do not reveal whether the account exists; also no-op if already verified.
        if (user is null || user.EmailVerified)
            return Result.Success();

        var rawToken = jwtService.GenerateRefreshTokenRaw();
        user.SetEmailVerificationToken(jwtService.HashToken(rawToken), DateTime.UtcNow.AddHours(48));
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        await emailService.SendEmailVerificationAsync(user.Email.Value, user.FullName, rawToken, ct);
        return Result.Success();
    }
}
