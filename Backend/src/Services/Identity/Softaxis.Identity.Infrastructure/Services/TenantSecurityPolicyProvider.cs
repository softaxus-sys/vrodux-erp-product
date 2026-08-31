using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Reads the tenant's Settings → Security values out of app_settings and turns them into the
/// policy the auth handlers enforce.
///
/// Cached for a minute: login, refresh and every password change consult it, and the underlying
/// rows change perhaps once a year. A save invalidates the entry so a change is never waiting on
/// the TTL.
/// </summary>
internal sealed class TenantSecurityPolicyProvider(
    IAppSettingRepository settings,
    IMemoryCache cache,
    ILogger<TenantSecurityPolicyProvider> logger) : ITenantSecurityPolicyProvider
{
    private const string Category = "security";
    private static string Key(Guid? tenantId) => $"tenant-security-policy::{tenantId?.ToString() ?? "none"}";

    public void Invalidate(Guid? tenantId) => cache.Remove(Key(tenantId));

    public async Task<TenantSecurityPolicy> GetAsync(Guid? tenantId, CancellationToken ct = default)
    {
        // A super admin operates outside any tenant, so there is no policy to apply to them.
        if (tenantId is null) return TenantSecurityPolicy.Permissive;

        if (cache.TryGetValue(Key(tenantId), out TenantSecurityPolicy? cached) && cached is not null)
            return cached;

        var policy = await LoadAsync(tenantId.Value, ct);
        cache.Set(Key(tenantId), policy, TimeSpan.FromMinutes(1));
        return policy;
    }

    private async Task<TenantSecurityPolicy> LoadAsync(Guid tenantId, CancellationToken ct)
    {
        try
        {
            // Company-wide rows only (userId: null) — security policy is not a personal preference.
            var rows = await settings.GetByCategoryAsync(Category, null, tenantId, ct);
            if (rows.Count == 0) return TenantSecurityPolicy.Permissive;

            var map = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .GroupBy(r => r.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value!.Trim(), StringComparer.OrdinalIgnoreCase);

            var d = TenantSecurityPolicy.Permissive;

            return new TenantSecurityPolicy(
                Enforce2FA:             Bool(map, "enforce2FA",             d.Enforce2FA),
                SingleSession:          Bool(map, "singleSession",          d.SingleSession),
                IpWhitelistEnabled:     Bool(map, "ipWhitelistEnabled",     d.IpWhitelistEnabled),
                IpWhitelist:            Str (map, "ipWhitelist",            d.IpWhitelist),
                SessionTimeoutMinutes:  Int (map, "sessionTimeout",         d.SessionTimeoutMinutes, 5, 43200),
                MaxLoginAttempts:       Int (map, "maxLoginAttempts",       d.MaxLoginAttempts, 3, 100),
                PasswordMinLength:      Int (map, "passwordMinLength",      d.PasswordMinLength, 6, 128),
                PasswordRequireUpper:   Bool(map, "passwordRequireUpper",   d.PasswordRequireUpper),
                PasswordRequireNumbers: Bool(map, "passwordRequireNumbers", d.PasswordRequireNumbers),
                PasswordRequireSymbols: Bool(map, "passwordRequireSymbols", d.PasswordRequireSymbols),
                // The UI stores "never" rather than a number for "no expiry".
                PasswordExpiryDays:     Int (map, "passwordExpiry",         d.PasswordExpiryDays, 1, 3650));
        }
        catch (Exception ex)
        {
            // An unreadable policy must not become an unopenable product.
            logger.LogWarning(ex, "Could not read the security policy for tenant {TenantId}; using defaults.", tenantId);
            return TenantSecurityPolicy.Permissive;
        }
    }

    private static string Str(IReadOnlyDictionary<string, string> map, string key, string fallback) =>
        map.TryGetValue(key, out var v) ? v : fallback;

    private static bool Bool(IReadOnlyDictionary<string, string> map, string key, bool fallback) =>
        map.TryGetValue(key, out var v) && bool.TryParse(v, out var b) ? b : fallback;

    /// <summary>
    /// Parses a numeric setting, clamped to a sane band. Anything unparseable — including the
    /// literal "never" the expiry selector stores — falls back, which for expiry means "off".
    /// </summary>
    private static int Int(IReadOnlyDictionary<string, string> map, string key, int fallback, int min, int max)
    {
        if (!map.TryGetValue(key, out var v)) return fallback;
        if (!int.TryParse(v, out var n)) return fallback;
        return Math.Clamp(n, min, max);
    }
}
