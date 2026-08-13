using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;
using RefreshTokenEntity = Softaxis.Identity.Domain.Entities.RefreshToken;

namespace Softaxis.Identity.Application.Auth.Commands.Login;

public sealed class LoginCommandHandler(
    IUserRepository         userRepo,
    IRefreshTokenRepository refreshRepo,
    IPermissionRepository   permissionRepo,
    ITenantRepository       tenantRepo,
    IPasswordHasher         passwordHasher,
    IJwtTokenService        jwtService,
    IAuditLogRepository     auditRepo,
    IUnitOfWork             uow)
    : ICommandHandler<LoginCommand, AuthTokenDto>
{
    public async Task<Result<AuthTokenDto>> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);
        if (user is null)
            return Fail(null, cmd, false, "Invalid email or password.");

        if (user.IsLocked)
            return Fail(user.Id, cmd, false, "Account is locked. Try again later.");

        if (!passwordHasher.Verify(cmd.Password, user.PasswordHash))
        {
            user.RecordLoginFailure();
            userRepo.Update(user);
            await uow.SaveChangesAsync(ct);
            return Fail(user.Id, cmd, false, "Invalid email or password.");
        }

        // Password is correct — but the email must be verified first (admin-created users start unverified).
        if (!user.EmailVerified)
            return Fail(user.Id, cmd, false,
                "Please verify your email address before logging in. Check your inbox for the verification link.");

        // Two-factor enabled → password is correct but we do NOT issue tokens yet. Return a short-lived
        // MFA challenge; the client completes login via /auth/verify-2fa with the authenticator code.
        if (user.TwoFactorEnabled)
        {
            var mfaToken = jwtService.GenerateMfaToken(user.Id);
            return Result.Success(new AuthTokenDto(string.Empty, string.Empty, DateTime.UtcNow, null,
                MfaRequired: true, MfaToken: mfaToken));
        }

        // Successful login
        user.RecordLoginSuccess();

        // Load tenant (null for super-admin users)
        var tenant = user.TenantId.HasValue
            ? await tenantRepo.GetByIdAsync(user.TenantId.Value, ct)
            : null;

        // A user bound to a tenant MUST resolve to a live one. Deleting a tenant soft-deletes it
        // (BaseDbContext turns Remove into IsDeleted = true) and the query filter then hides it —
        // so without this check the login succeeded with tenant = null, which is strictly WORSE
        // than blocking: the token carries no tenant_id/modules/subscription_state claims, so
        // SubscriptionEnforcementMiddleware waves it straight through and the frontend falls back
        // to a full module list. Deleted tenants' users would get an unrestricted-looking session.
        // Super admins legitimately have no TenantId, hence the HasValue guard.
        if (user.TenantId.HasValue && tenant is null)
            return Fail(user.Id, cmd, false,
                "This workspace is no longer available. Please contact your administrator.");

        // Issue tokens
        var permKeys = await permissionRepo.GetPermissionKeysForUserAsync(user.Id, ct);
        var rawRefresh = jwtService.GenerateRefreshTokenRaw();
        var refreshHash = jwtService.HashToken(rawRefresh);

        var refreshToken = new RefreshTokenEntity(user.Id, refreshHash, jwtService.RefreshTokenExpiry, cmd.IpAddress);
        refreshRepo.Add(refreshToken);
        userRepo.Update(user);

        // Audit
        auditRepo.Add(new AuditLog(user.Id, "LOGIN", "User", user.Id.ToString(), null, null, cmd.IpAddress, null, true, user.TenantId));

        await uow.SaveChangesAsync(ct);

        var accessToken = jwtService.GenerateAccessToken(user, permKeys, tenant);
        var dto         = MapToDto(user, accessToken, rawRefresh);

        return Result.Success(dto);
    }

    private static Result<AuthTokenDto> Fail(Guid? userId, LoginCommand cmd, bool succeeded, string msg)
        => Result.Failure<AuthTokenDto>(Error.Custom("Auth.Login.Failed", msg));

    private AuthTokenDto MapToDto(Domain.Entities.User user, string accessToken, string rawRefresh) =>
        new(
            accessToken,
            rawRefresh,
            jwtService.AccessTokenExpiry,
            UserDtoMapper.ToDto(user)
        );
}
