using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using RefreshTokenEntity = Softaxis.Identity.Domain.Entities.RefreshToken;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.RefreshToken;

public sealed class RefreshTokenCommandHandler(
    IRefreshTokenRepository refreshRepo,
    IUserRepository         userRepo,
    IPermissionRepository   permissionRepo,
    ITenantRepository       tenantRepo,
    IJwtTokenService        jwtService,
    IUnitOfWork             uow)
    : ICommandHandler<RefreshTokenCommand, AuthTokenDto>
{
    public async Task<Result<AuthTokenDto>> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        var tokenHash    = jwtService.HashToken(cmd.Token);
        var refreshToken = await refreshRepo.GetByHashAsync(tokenHash, ct);

        if (refreshToken is null || !refreshToken.IsActive)
            return Result.Failure<AuthTokenDto>(Error.Custom("Auth.Refresh.Invalid", "Refresh token is invalid or expired."));

        var user = await userRepo.GetByIdAsync(refreshToken.UserId, ct);
        if (user is null || user.Status != Domain.Enums.UserStatus.Active)
            return Result.Failure<AuthTokenDto>(Error.Custom("Auth.Refresh.UserInactive", "User account is not active."));

        // Rotate: revoke old, issue new
        var newRaw      = jwtService.GenerateRefreshTokenRaw();
        var newHash     = jwtService.HashToken(newRaw);
        refreshToken.Revoke(cmd.IpAddress, newHash);

        var newToken = new RefreshTokenEntity(user.Id, newHash, jwtService.RefreshTokenExpiry, cmd.IpAddress);
        refreshRepo.Add(newToken);
        refreshRepo.Update(refreshToken);

        var tenant      = user.TenantId.HasValue
            ? await tenantRepo.GetByIdAsync(user.TenantId.Value, ct)
            : null;

        // Same guard as login: a tenant-bound user whose tenant has been deleted must not get a
        // fresh token. Without this, deleting a tenant would only take effect when the current
        // access token expired — and the refresh would then mint a tenant-less token that bypasses
        // subscription enforcement entirely. Refusing here ends the session at the next refresh.
        if (user.TenantId.HasValue && tenant is null)
            return Result.Failure<AuthTokenDto>(Error.Custom(
                "Auth.Refresh.Failed",
                "This workspace is no longer available. Please contact your administrator."));

        var permKeys    = await permissionRepo.GetPermissionKeysForUserAsync(user.Id, ct);
        var accessToken = jwtService.GenerateAccessToken(user, permKeys, tenant);

        await uow.SaveChangesAsync(ct);

        return Result.Success(new AuthTokenDto(
            accessToken, newRaw, jwtService.AccessTokenExpiry,
            UserDtoMapper.ToDto(user)));
    }
}
