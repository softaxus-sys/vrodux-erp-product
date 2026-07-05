using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Services;

public sealed class JwtSettings
{
    public string  Secret           { get; init; } = string.Empty;
    public string  Issuer           { get; init; } = string.Empty;
    public string  Audience         { get; init; } = string.Empty;
    public int     AccessTokenMinutes  { get; init; } = 60;
    public int     RefreshTokenDays    { get; init; } = 30;
}

public sealed class JwtTokenService(IOptions<JwtSettings> options) : IJwtTokenService
{
    private readonly JwtSettings _settings = options.Value;

    public DateTime AccessTokenExpiry  => DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes);
    public DateTime RefreshTokenExpiry => DateTime.UtcNow.AddDays(_settings.RefreshTokenDays);

    public string GenerateAccessToken(User user, IEnumerable<string> permissionKeys, Tenant? tenant = null)
    {
        var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry  = AccessTokenExpiry;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email.Value),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("username",     user.Username),
            new("firstName",    user.FirstName),
            new("lastName",     user.LastName),
            new("status",       user.Status.ToString()),
            new("is_super_admin", user.IsSuperAdmin.ToString().ToLowerInvariant()),
        };

        // Tenant context claims (null for super-admin)
        if (tenant is not null)
        {
            claims.Add(new Claim("tenant_id",   tenant.Id.ToString()));
            claims.Add(new Claim("tenant_slug", tenant.Slug));
            claims.Add(new Claim("tenant_name", tenant.Name));
            claims.Add(new Claim("plan",        tenant.Plan.ToString()));

            // Embed resolved module list — avoids DB round-trip for module enforcement.
            // ResolvedModules returns override if set, else plan defaults.
            claims.Add(new Claim("modules", string.Join(",", tenant.ResolvedModules)));

            // Industry vertical — lets the frontend render Industry-Pack-specific UI/labels.
            if (!string.IsNullOrWhiteSpace(tenant.Industry))
                claims.Add(new Claim("industry", tenant.Industry));

            // Operating/display currency — drives formatCurrency across the app (USD default).
            claims.Add(new Claim("currency", string.IsNullOrWhiteSpace(tenant.Currency) ? "USD" : tenant.Currency));
        }

        // Embed all permissions as claims — avoids DB round-trip on every request
        foreach (var perm in permissionKeys)
            claims.Add(new Claim("permission", perm));

        var token = new JwtSecurityToken(
            issuer:             _settings.Issuer,
            audience:           _settings.Audience,
            claims:             claims,
            expires:            expiry,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshTokenRaw() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public string HashToken(string rawToken) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
