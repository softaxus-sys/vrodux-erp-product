using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Softaxis.Library.Infrastructure.Services;

/// <summary>What a valid member session says. The member is still re-read on every request.</summary>
public sealed record PortalSession(Guid TenantId, Guid MemberId, string PinStamp);

public interface IPortalSecurity
{
    string NewPin();
    string HashPin(string pin);
    bool VerifyPin(string pin, string hash);
    /// <summary>Changes whenever the PIN does, so a new or removed PIN ends every open session.</summary>
    string PinStamp(string pinHash);
    (string Token, DateTime ExpiresAt) CreateToken(Guid tenantId, Guid memberId, string pinHash);
    PortalSession? ReadToken(string? token);
}

/// <summary>
/// PIN hashing (PBKDF2) and a small signed session token for the member portal.
///
/// Members are not Identity users — a library can have thousands, and they must not consume plan
/// seats or be able to reach the staff application. So the session is its own token, signed with a
/// key derived from the JWT secret under a label of its own: it cannot be mistaken for, or used
/// as, a staff access token.
/// </summary>
internal sealed class PortalSecurity : IPortalSecurity
{
    private const int Iterations = 100_000;
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);
    private readonly byte[] _key;

    public PortalSecurity(IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"] ?? configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        _key = SHA256.HashData(Encoding.UTF8.GetBytes("vrodux::library-portal::" + secret));
    }

    public string NewPin() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture);

    public string HashPin(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(pin, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"v1.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPin(string pin, string hash)
    {
        var parts = hash.Split('.');
        if (parts.Length != 3 || parts[0] != "v1") return false;
        try
        {
            var salt     = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            var actual   = Rfc2898DeriveBytes.Pbkdf2(pin, salt, Iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }

    public string PinStamp(string pinHash) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(pinHash)))[..16];

    public (string Token, DateTime ExpiresAt) CreateToken(Guid tenantId, Guid memberId, string pinHash)
    {
        var expires = DateTime.UtcNow.Add(Lifetime);
        var payload = string.Create(CultureInfo.InvariantCulture,
            $"{tenantId:N}.{memberId:N}.{new DateTimeOffset(expires).ToUnixTimeSeconds()}.{PinStamp(pinHash)}");
        return ($"{payload}.{Sign(payload)}", expires);
    }

    public PortalSession? ReadToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 300) return null;
        var cut = token.LastIndexOf('.');
        if (cut <= 0) return null;

        var payload = token[..cut];
        var given   = Encoding.ASCII.GetBytes(token[(cut + 1)..]);
        var wanted  = Encoding.ASCII.GetBytes(Sign(payload));
        if (!CryptographicOperations.FixedTimeEquals(given, wanted)) return null;

        var parts = payload.Split('.');
        if (parts.Length != 4
            || !Guid.TryParseExact(parts[0], "N", out var tenantId)
            || !Guid.TryParseExact(parts[1], "N", out var memberId)
            || !long.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var exp)
            || DateTimeOffset.FromUnixTimeSeconds(exp) < DateTimeOffset.UtcNow)
            return null;

        return new PortalSession(tenantId, memberId, parts[3]);
    }

    private string Sign(string payload) =>
        Convert.ToHexString(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes(payload)));
}
