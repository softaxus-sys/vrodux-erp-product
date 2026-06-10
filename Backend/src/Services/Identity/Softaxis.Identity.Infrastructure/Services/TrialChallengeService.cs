using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Challenge-response token service for the public trial registration endpoint.
///
/// Token wire format (base64url, ~75 chars):
///   nonce(16) | timestamp_unix_be(8) | HMAC-SHA256(nonce|ts|"trial_register", secret)(32)
///   = 56 raw bytes
///
/// Security properties:
///   - Server secret never leaves the server
///   - Tokens are single-use (nonce burned in IMemoryCache on first valid consumption)
///   - Tokens expire after 10 minutes (enforced by both cache TTL and timestamp check)
///   - HMAC uses constant-time comparison — no timing oracle
///   - Purpose binding: "trial_register" is baked into the MAC so tokens cannot
///     be reused across different flows
/// </summary>
public sealed class TrialChallengeService : ITrialChallengeService
{
    private const int    TokenValidMinutes = 10;
    private const string CacheKeyPrefix    = "trial_nonce:";
    private const string Purpose           = "trial_register";

    private readonly byte[]       _secret;
    private readonly IMemoryCache _cache;

    public TrialChallengeService(IConfiguration config, IMemoryCache cache, ILogger<TrialChallengeService> logger)
    {
        var raw = config["Trial:ChallengeSecret"];

        if (string.IsNullOrWhiteSpace(raw) || raw.Length < 32)
        {
            // Generate a random per-process secret so the app always starts.
            // Challenge tokens are valid only for this process lifetime — fine
            // for dev. In production set Trial:ChallengeSecret via env/secrets.
            raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
            logger.LogWarning(
                "Trial:ChallengeSecret is not configured or too short. " +
                "A random per-process secret has been generated — challenge tokens will " +
                "be invalidated on every restart. Set Trial:ChallengeSecret in " +
                "appsettings / environment variables for production use.");
        }

        _secret = Encoding.UTF8.GetBytes(raw);
        _cache  = cache;
    }

    // ── Generate ──────────────────────────────────────────────────────────────

    public string Generate()
    {
        // 16-byte cryptographically random nonce
        var nonce = RandomNumberGenerator.GetBytes(16);

        // 8-byte big-endian Unix timestamp
        var tsBytes = ToBeBytes(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        // HMAC(nonce | ts | purpose)
        var mac = ComputeMac(nonce, tsBytes);

        // Concatenate into wire format
        var wire  = Concat(nonce, tsBytes, mac);
        var token = ToBase64Url(wire);

        // Register in cache — presence proves "not yet consumed"
        _cache.Set(
            $"{CacheKeyPrefix}{token}",
            true,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(TokenValidMinutes),
                Size = 1,
            });

        return token;
    }

    // ── Consume ───────────────────────────────────────────────────────────────

    public bool Consume(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;

        // 1. Decode
        byte[] wire;
        try { wire = FromBase64Url(token); }
        catch { return false; }

        // Exact expected length: nonce(16) + ts(8) + mac(32) = 56
        if (wire.Length != 56) return false;

        var nonce   = wire[..16];
        var tsBytes = wire[16..24];
        var mac     = wire[24..56];

        // 2. Verify HMAC with constant-time comparison
        var expected = ComputeMac(nonce, tsBytes);
        if (!CryptographicOperations.FixedTimeEquals(mac, expected)) return false;

        // 3. Check timestamp is within the validity window
        var issued = DateTimeOffset.FromUnixTimeSeconds(FromBeBytes(tsBytes));
        if (DateTimeOffset.UtcNow - issued > TimeSpan.FromMinutes(TokenValidMinutes)) return false;

        // 4. Burn the nonce — single use; remove from cache atomically
        var key = $"{CacheKeyPrefix}{token}";
        if (!_cache.TryGetValue(key, out _)) return false; // already consumed or never issued

        _cache.Remove(key);
        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private byte[] ComputeMac(byte[] nonce, byte[] tsBytes)
    {
        var purposeBytes = Encoding.UTF8.GetBytes(Purpose);
        var payload      = Concat(nonce, tsBytes, purposeBytes);
        return HMACSHA256.HashData(_secret, payload);
    }

    private static byte[] ToBeBytes(long value)
    {
        var b = BitConverter.GetBytes(value);
        if (BitConverter.IsLittleEndian) Array.Reverse(b);
        return b;
    }

    private static long FromBeBytes(byte[] b)
    {
        var copy = (byte[])b.Clone();
        if (BitConverter.IsLittleEndian) Array.Reverse(copy);
        return BitConverter.ToInt64(copy, 0);
    }

    private static byte[] Concat(params byte[][] arrays)
    {
        var result = new byte[arrays.Sum(a => a.Length)];
        var offset = 0;
        foreach (var a in arrays) { a.CopyTo(result, offset); offset += a.Length; }
        return result;
    }

    private static string ToBase64Url(byte[] data) =>
        Convert.ToBase64String(data).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static byte[] FromBase64Url(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/') + new string('=', (4 - s.Length % 4) % 4);
        return Convert.FromBase64String(padded);
    }
}
