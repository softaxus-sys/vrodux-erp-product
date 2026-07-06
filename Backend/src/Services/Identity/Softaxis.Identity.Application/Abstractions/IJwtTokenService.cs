using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Abstractions;

public interface IJwtTokenService
{
    /// <param name="tenant">Pass tenant for tenant-scoped users; null for super-admins.</param>
    string GenerateAccessToken(User user, IEnumerable<string> permissionKeys, Tenant? tenant = null, Guid? impersonatedBy = null);
    string GenerateRefreshTokenRaw();          // plain-text — caller must hash before persisting
    string HashToken(string rawToken);
    DateTime AccessTokenExpiry { get; }
    DateTime RefreshTokenExpiry { get; }
}
