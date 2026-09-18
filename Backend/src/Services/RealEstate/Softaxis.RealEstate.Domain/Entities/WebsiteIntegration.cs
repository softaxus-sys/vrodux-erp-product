using System.Security.Cryptography;
using System.Text;

namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// A workspace's connection to its public website: the one website allowed to read its published
/// listings, and the API key that website presents.
///
/// One per workspace (tenant-unique index). The key itself is never stored — only its SHA-256
/// hash, plus a short prefix so an administrator can tell which key a site is configured with.
/// A key is shown exactly once, when it is generated.
/// </summary>
public sealed class WebsiteIntegration
{
    public const string KeyPrefix = "vrx_live_";

    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = "";

    /// <summary>Normalised origin, e.g. <c>https://leadingproperties.ae</c> — scheme + host (+ port).</summary>
    public string WebsiteOrigin { get; private set; } = "";

    /// <summary>Hex SHA-256 of the full key. Globally unique: it is how an anonymous request finds its workspace.</summary>
    public string KeyHash { get; private set; } = "";

    /// <summary>First characters of the key, safe to display ("vrx_live_AbC1…").</summary>
    public string KeyHint { get; private set; } = "";

    /// <summary>Off = the website receives nothing, without losing the configuration or the key.</summary>
    public bool IsActive { get; private set; } = true;

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime KeyGeneratedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private WebsiteIntegration() { }

    /// <summary>Creates the integration and returns the plaintext key, which the caller shows once.</summary>
    public static (WebsiteIntegration Integration, string ApiKey) Create(string name, string websiteOrigin)
    {
        var integration = new WebsiteIntegration
        {
            Name = name.Trim(),
            WebsiteOrigin = websiteOrigin,
        };
        var key = integration.RotateKey();
        return (integration, key);
    }

    public void Update(string name, string websiteOrigin)
    {
        Name = name.Trim();
        WebsiteOrigin = websiteOrigin;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Replaces the key. The old key stops working immediately — on the next request.</summary>
    public string RotateKey()
    {
        // 32 random bytes → 256 bits of entropy. A fast hash is appropriate at this entropy: there
        // is no dictionary to attack, unlike a password.
        var raw = KeyPrefix + Base64Url(RandomNumberGenerator.GetBytes(32));
        KeyHash = Hash(raw);
        KeyHint = raw[..(KeyPrefix.Length + 4)];
        KeyGeneratedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return raw;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAt = DateTime.UtcNow;
    }

    public static string Hash(string apiKey) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(apiKey))).ToLowerInvariant();

    /// <summary>
    /// Normalises a URL to its origin, or returns null when it is not an absolute http(s) URL.
    /// Only the origin is compared — a path would make the check fail for every page but one.
    /// </summary>
    public static string? NormaliseOrigin(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var u)) return null;
        if (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp) return null;
        return u.IsDefaultPort
            ? $"{u.Scheme}://{u.Host}".ToLowerInvariant()
            : $"{u.Scheme}://{u.Host}:{u.Port}".ToLowerInvariant();
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
