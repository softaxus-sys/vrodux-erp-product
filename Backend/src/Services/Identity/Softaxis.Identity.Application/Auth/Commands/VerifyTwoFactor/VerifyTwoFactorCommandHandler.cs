using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;
using RefreshTokenEntity = Softaxis.Identity.Domain.Entities.RefreshToken;

namespace Softaxis.Identity.Application.Auth.Commands.VerifyTwoFactor;

/// <summary>
/// Step 2 of a 2FA login. Validates the short-lived MFA token from step 1 (password), then the
/// authenticator code (or a one-time backup code), and only then issues the real access/refresh tokens.
/// </summary>
public sealed class VerifyTwoFactorCommandHandler(
    IUserRepository         userRepo,
    IRefreshTokenRepository refreshRepo,
    IPermissionRepository   permissionRepo,
    ITenantRepository       tenantRepo,
    IJwtTokenService        jwtService,
    ITotpService            totp,
    ITotpSecretProtector    protector,
    IAuditLogRepository     auditRepo,
    IUnitOfWork             uow)
    : ICommandHandler<VerifyTwoFactorCommand, AuthTokenDto>
{
    public async Task<Result<AuthTokenDto>> Handle(VerifyTwoFactorCommand cmd, CancellationToken ct)
    {
        var userId = jwtService.ValidateMfaToken(cmd.MfaToken);
        if (userId is null)
            return Fail("Your verification session has expired. Please sign in again.");

        var user = await userRepo.GetByIdAsync(userId.Value, ct);
        if (user is null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
            return Fail("Two-factor authentication is not set up for this account.");

        if (user.IsLocked)
            return Fail("Account is locked. Try again later.");

        var code = (cmd.Code ?? string.Empty).Trim();

        // First try the rolling authenticator code, then fall back to a one-time backup code.
        var secret = protector.Unprotect(user.TwoFactorSecret);
        var ok = totp.VerifyCode(secret, code) || user.ConsumeBackupCode(BackupCodeHasher.Hash(code));

        if (!ok)
        {
            user.RecordLoginFailure();
            userRepo.Update(user);
            auditRepo.Add(new AuditLog(user.Id, "LOGIN_2FA_FAILED", "User", user.Id.ToString(), null, null, cmd.IpAddress, null, false, user.TenantId));
            await uow.SaveChangesAsync(ct);
            return Fail("Invalid authentication code.");
        }

        // Success — issue the real tokens (mirrors LoginCommandHandler's success path).
        user.RecordLoginSuccess();

        var tenant = user.TenantId.HasValue
            ? await tenantRepo.GetByIdAsync(user.TenantId.Value, ct)
            : null;

        var permKeys    = await permissionRepo.GetPermissionKeysForUserAsync(user.Id, ct);
        var rawRefresh  = jwtService.GenerateRefreshTokenRaw();
        var refreshHash = jwtService.HashToken(rawRefresh);

        refreshRepo.Add(new RefreshTokenEntity(user.Id, refreshHash, jwtService.RefreshTokenExpiry, cmd.IpAddress));
        userRepo.Update(user);
        auditRepo.Add(new AuditLog(user.Id, "LOGIN", "User", user.Id.ToString(), null, null, cmd.IpAddress, null, true, user.TenantId));

        await uow.SaveChangesAsync(ct);

        var accessToken = jwtService.GenerateAccessToken(user, permKeys, tenant);
        return Result.Success(new AuthTokenDto(accessToken, rawRefresh, jwtService.AccessTokenExpiry, UserDtoMapper.ToDto(user)));
    }

    private static Result<AuthTokenDto> Fail(string msg)
        => Result.Failure<AuthTokenDto>(Error.Custom("Auth.TwoFactor.Failed", msg));
}
