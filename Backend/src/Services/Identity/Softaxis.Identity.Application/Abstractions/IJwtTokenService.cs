using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Abstractions;

public interface IJwtTokenService
{
    /// <param name="tenant">Pass tenant for tenant-scoped users; null for super-admins.</param>
    /// <param name="sessionMinutes">
    /// The tenant's configured session timeout. 0 (the default) uses the deployment-wide
    /// Jwt:AccessTokenMinutes, so a tenant that has not set one is unaffected.
    /// </param>
    string GenerateAccessToken(User user, IEnumerable<string> permissionKeys, Tenant? tenant = null,
                               Guid? impersonatedBy = null, int sessionMinutes = 0);

    /// <summary>Expiry that a token minted with <paramref name="sessionMinutes"/> will carry.</summary>
    DateTime AccessTokenExpiryFor(int sessionMinutes);
    string GenerateRefreshTokenRaw();          // plain-text — caller must hash before persisting
    string HashToken(string rawToken);
    DateTime AccessTokenExpiry { get; }
    DateTime RefreshTokenExpiry { get; }

    /// <summary>
    /// Short-lived (5 min) signed token issued after a correct password when the account has 2FA
    /// enabled. It only authorizes a follow-up call to verify the authenticator code — it grants no
    /// access on its own.
    /// </summary>
    string GenerateMfaToken(Guid userId);

    /// <summary>Validate an MFA-pending token; returns the user id if valid + unexpired, else null.</summary>
    Guid? ValidateMfaToken(string token);
}
