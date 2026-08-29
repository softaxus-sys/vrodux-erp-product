using System.Net;
using System.Net.Sockets;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// The tenant's Settings → Security choices, as the backend actually enforces them.
///
/// Every one of these was previously write-only: the panel saved ten values into app_settings and
/// nothing anywhere read them back, so a tenant could set a 14-character password policy, a
/// 3-attempt lockout and mandatory 2FA and get none of it. This record is what closes that.
///
/// <b>Defaults are deliberately permissive.</b> The settings panel's own defaults are opinionated
/// (2FA on, 90-day expiry) because they are what a new tenant is *shown*; if those same values
/// became the enforced defaults, every tenant that had never opened the panel would be subjected
/// to them on the first deploy that read them. Only what a tenant has explicitly saved applies.
/// </summary>
public sealed record TenantSecurityPolicy(
    bool   Enforce2FA,
    bool   SingleSession,
    bool   IpWhitelistEnabled,
    string IpWhitelist,
    int    SessionTimeoutMinutes,
    int    MaxLoginAttempts,
    int    PasswordMinLength,
    bool   PasswordRequireUpper,
    bool   PasswordRequireNumbers,
    bool   PasswordRequireSymbols,
    /// <summary>Days before a password must be changed. 0 = never expires.</summary>
    int    PasswordExpiryDays)
{
    /// <summary>
    /// What applies to a tenant that has never saved the panel, and to super admins who have no
    /// tenant at all. Matches the behaviour that shipped before any of this was enforced, so
    /// reading the policy can never change anyone's experience until they choose to configure it.
    /// </summary>
    public static TenantSecurityPolicy Permissive { get; } = new(
        Enforce2FA:             false,
        SingleSession:          false,
        IpWhitelistEnabled:     false,
        IpWhitelist:            "",
        SessionTimeoutMinutes:  0,      // 0 = fall back to the deployment's Jwt:AccessTokenMinutes
        MaxLoginAttempts:       5,      // the value already hardcoded in User.RecordLoginFailure
        PasswordMinLength:      8,      // the value already hardcoded across the validators
        PasswordRequireUpper:   false,
        PasswordRequireNumbers: false,
        PasswordRequireSymbols: false,
        PasswordExpiryDays:     0);

    /// <summary>
    /// True when <paramref name="ip"/> is covered by the whitelist. An empty list allows
    /// everything: an enabled-but-empty whitelist is a misconfiguration, and treating it as
    /// "deny all" would lock the tenant out of their own workspace.
    /// </summary>
    public bool AllowsIp(string? ip)
    {
        if (!IpWhitelistEnabled) return true;

        var entries = IpWhitelist
            .Split([',', ';', '\n', '\r', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();
        if (entries.Length == 0) return true;

        if (!IPAddress.TryParse(ip, out var address)) return false;

        foreach (var entry in entries)
        {
            if (entry.Contains('/'))
            {
                if (IpInCidr(address, entry)) return true;
            }
            else if (IPAddress.TryParse(entry, out var single) && single.Equals(address))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>Plain CIDR containment. Returns false rather than throwing on a malformed entry.</summary>
    private static bool IpInCidr(IPAddress address, string cidr)
    {
        var parts = cidr.Split('/', 2);
        if (parts.Length != 2
            || !IPAddress.TryParse(parts[0], out var network)
            || !int.TryParse(parts[1], out var prefix)) return false;

        if (network.AddressFamily != address.AddressFamily) return false;

        var maxPrefix = network.AddressFamily == AddressFamily.InterNetworkV6 ? 128 : 32;
        if (prefix < 0 || prefix > maxPrefix) return false;

        var netBytes  = network.GetAddressBytes();
        var addrBytes = address.GetAddressBytes();

        var fullBytes = prefix / 8;
        for (var i = 0; i < fullBytes; i++)
            if (netBytes[i] != addrBytes[i]) return false;

        var remainingBits = prefix % 8;
        if (remainingBits == 0) return true;

        var mask = (byte)(0xFF << (8 - remainingBits));
        return (netBytes[fullBytes] & mask) == (addrBytes[fullBytes] & mask);
    }
}

public interface ITenantSecurityPolicyProvider
{
    /// <summary>
    /// The effective policy for a tenant. Never throws — a settings-read failure returns the
    /// permissive default, because an unreadable policy must not become an unopenable product.
    /// </summary>
    Task<TenantSecurityPolicy> GetAsync(Guid? tenantId, CancellationToken ct = default);

    /// <summary>Drops the cached policy so a save takes effect on the very next request.</summary>
    void Invalidate(Guid? tenantId);
}

/// <summary>
/// The one place password rules are applied, so the six paths that set a password
/// (register, admin create, provision, change, reset, admin reset) cannot drift apart.
/// </summary>
public static class PasswordPolicy
{
    public static Result Validate(string? password, TenantSecurityPolicy policy)
    {
        password ??= string.Empty;

        var problems = new List<string>();

        if (password.Length < policy.PasswordMinLength)
            problems.Add($"be at least {policy.PasswordMinLength} characters");

        if (policy.PasswordRequireUpper && !password.Any(char.IsUpper))
            problems.Add("include an uppercase letter");

        if (policy.PasswordRequireNumbers && !password.Any(char.IsDigit))
            problems.Add("include a number");

        // "Not a letter, digit or whitespace" rather than a fixed symbol list, so a password is
        // never rejected for using a punctuation mark the list happened to omit.
        if (policy.PasswordRequireSymbols && !password.Any(c => !char.IsLetterOrDigit(c) && !char.IsWhiteSpace(c)))
            problems.Add("include a symbol");

        if (problems.Count == 0) return Result.Success();

        return Result.Failure(Error.Custom(
            "Validation.Failed",
            $"Password must {Join(problems)}."));
    }

    private static string Join(IReadOnlyList<string> parts) =>
        parts.Count == 1 ? parts[0]
        : string.Join(", ", parts.Take(parts.Count - 1)) + " and " + parts[^1];
}
