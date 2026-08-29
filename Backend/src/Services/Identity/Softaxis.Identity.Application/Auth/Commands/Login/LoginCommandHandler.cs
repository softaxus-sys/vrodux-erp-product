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
    ITenantSecurityPolicyProvider securityPolicy,
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

        // The tenant's own lockout threshold, not the hardcoded 5. Read before the password is
        // verified so a failed attempt is counted against the right limit.
        var policy = await securityPolicy.GetAsync(user.TenantId, ct);

        if (!passwordHasher.Verify(cmd.Password, user.PasswordHash))
        {
            user.RecordLoginFailure(policy.MaxLoginAttempts);
            userRepo.Update(user);
            await uow.SaveChangesAsync(ct);
            return Fail(user.Id, cmd, false, "Invalid email or password.");
        }

        // Network restriction, if the tenant configured one. Checked after the password so it
        // cannot be used to probe which addresses are allowed without valid credentials.
        if (!policy.AllowsIp(cmd.IpAddress))
            return Fail(user.Id, cmd, false,
                "Sign-in from this network is not permitted. Contact your administrator.");

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

        // The tenant requires two-factor and this user has not enrolled. Deliberately NOT a
        // refusal: blocking would lock out every user in the tenant the moment the switch is
        // flipped, including the admin who flipped it. The session is issued and flagged, and the
        // app routes them to Settings -> Security to enrol. (A user who HAS enrolled never
        // reaches here — they were sent down the MFA-challenge path above.)
        var mustSetUpTwoFactor = policy.Enforce2FA && !user.TwoFactorEnabled;

        // Password older than the tenant's expiry window: allow the login but force a change,
        // reusing the existing MustChangePassword flow rather than inventing a second one.
        if (user.IsPasswordExpired(policy.PasswordExpiryDays, DateTime.UtcNow))
            user.RequirePasswordChange();

        // One live session per user: retire every refresh token this user still holds before
        // issuing the new one, so signing in here signs them out everywhere else.
        if (policy.SingleSession)
            await refreshRepo.RevokeAllForUserAsync(user.Id, ct);

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

        var accessToken = jwtService.GenerateAccessToken(user, permKeys, tenant, sessionMinutes: policy.SessionTimeoutMinutes);
        var expiry      = jwtService.AccessTokenExpiryFor(policy.SessionTimeoutMinutes);

        return Result.Success(new AuthTokenDto(
            accessToken, rawRefresh, expiry, UserDtoMapper.ToDto(user),
            MustSetUpTwoFactor: mustSetUpTwoFactor));
    }

    private static Result<AuthTokenDto> Fail(Guid? userId, LoginCommand cmd, bool succeeded, string msg)
        => Result.Failure<AuthTokenDto>(Error.Custom("Auth.Login.Failed", msg));
}
