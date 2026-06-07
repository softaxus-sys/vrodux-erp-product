using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.RevokeToken;

public sealed class RevokeTokenCommandHandler(
    IRefreshTokenRepository refreshRepo,
    IJwtTokenService        jwtService,
    IUnitOfWork             uow)
    : ICommandHandler<RevokeTokenCommand>
{
    public async Task<Result> Handle(RevokeTokenCommand cmd, CancellationToken ct)
    {
        var hash  = jwtService.HashToken(cmd.Token);
        var token = await refreshRepo.GetByHashAsync(hash, ct);

        if (token is null || !token.IsActive)
            return Result.Failure(Error.Custom("Auth.Revoke.Invalid", "Token not found or already revoked."));

        token.Revoke(cmd.IpAddress);
        refreshRepo.Update(token);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
