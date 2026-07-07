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

    public string GenerateAccessToken(User user, IEnumerable<string> permissionKeys, Tenant? tenant = null, Guid? impersonatedBy = null)
    {
        var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry  = AccessTokenExpiry;

        // When a super-admin is impersonating a tenant, the token is scoped to that tenant:
        // is_super_admin is forced FALSE so the DB tenant filter scopes to the tenant (rather than
        // bypassing), while `impersonated_by` records who is acting for audit/UI.
        var isSuperAdmin = impersonatedBy is null && user.IsSuperAdmin;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email.Value),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("username",     user.Username),
            new("firstName",    user.FirstName),
            new("lastName",     user.LastName),
            new("status",       user.Status.ToString()),
            new("is_super_admin", isSuperAdmin.ToString().ToLowerInvariant()),
        };

        if (impersonatedBy is not null)
            claims.Add(new Claim("impersonated_by", impersonatedBy.Value.ToString()));

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

    // ── Two-factor (MFA) pending token ─────────────────────────────────────────

    // Distinct audience so the main JWT bearer auth (which requires _settings.Audience) REJECTS this
    // token — it can only be used against /auth/verify-2fa, never as an access token. This is what
    // prevents the post-password / pre-2FA token from bypassing 2FA on [Authorize] endpoints.
    private const string MfaAudience = "vrodux:mfa-pending";

    public string GenerateMfaToken(Guid userId)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             _settings.Issuer,
            audience:           MfaAudience,
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim("mfa_pending", "true"),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            },
            expires:            DateTime.UtcNow.AddMinutes(5),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public Guid? ValidateMfaToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidIssuer              = _settings.Issuer,
                ValidateAudience         = true,
                ValidAudience            = MfaAudience,
                ValidateLifetime         = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret)),
                ClockSkew                = TimeSpan.FromSeconds(30),
            }, out _);

            if (principal.FindFirst("mfa_pending")?.Value != "true") return null;

            // JwtSecurityTokenHandler remaps "sub" → ClaimTypes.NameIdentifier by default.
            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                      ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }
        catch
        {
            return null;
        }
    }
}
