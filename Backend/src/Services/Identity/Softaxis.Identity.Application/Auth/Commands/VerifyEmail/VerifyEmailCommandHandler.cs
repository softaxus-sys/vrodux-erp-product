using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.VerifyEmail;

public sealed class VerifyEmailCommandHandler(
    IUserRepository  userRepo,
    IJwtTokenService jwtService,
    IUnitOfWork      uow)
    : ICommandHandler<VerifyEmailCommand>
{
    public async Task<Result> Handle(VerifyEmailCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);
        if (user is null)
            return Result.Failure(Error.Custom("Auth.VerifyEmail.Invalid", "Invalid or expired verification link."));

        if (user.EmailVerified)
            return Result.Success(); // Idempotent — already verified.

        var tokenHash = jwtService.HashToken(cmd.Token);
        if (!user.VerifyEmailWithToken(tokenHash))
            return Result.Failure(Error.Custom("Auth.VerifyEmail.Invalid", "Invalid or expired verification link."));

        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
