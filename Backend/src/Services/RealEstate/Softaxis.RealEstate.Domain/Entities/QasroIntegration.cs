using System.Security.Cryptography;
using System.Text;

namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// A workspace's connection to Qasro (qasro.com) — Softaxis's sister property portal.
///
/// Deliberately simpler than <see cref="WebsiteIntegration"/>: there is no address to type in and
/// no key to copy-paste. Both products are owned by Softaxis, so the one-click "Activate Qasro"
/// flow generates the key here and hands it to Qasro server-to-server (see IQasroClient) — the
/// tenant never sees or manages it, the same way they never see an API key for their own website
/// integration's underlying mechanism, just without even the address/name form around it.
///
/// One per workspace (tenant-unique index, same as WebsiteIntegration). The key itself is never
/// stored — only its SHA-256 hash — so a database leak cannot be used to impersonate Qasro's pull.
/// </summary>
public sealed class QasroIntegration
{
    public const string KeyPrefix = "vrx_qasro_";

    /// <summary>The one fixed origin every Qasro-sourced request must present. Not user-configurable
    /// — unlike WebsiteIntegration, which connects to whatever address the tenant types in.</summary>
    public const string Origin = "https://qasro.com";

    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>Qasro's own id for the agency record created/linked at connect time. Used to
    /// address Qasro when withdrawing everything on disconnect, and lets Qasro's own systems
    /// resolve which agency an inbound lead or listing update belongs to.</summary>
    public string? QasroAgencyId { get; private set; }

    public string KeyHash { get; private set; } = "";

    /// <summary>Never shown to the tenant (there is nothing for them to paste it into) — kept only
    /// so a support engineer can confirm which key a failed sync attempt used.</summary>
    public string KeyHint { get; private set; } = "";

    /// <summary>connecting | connected | error | disconnected. "Connecting" is the state between
    /// generating the key locally and Qasro's link-agency call confirming it — see ConnectQasroHandler.</summary>
    public string Status { get; private set; } = "connecting";

    public string? LastError { get; private set; }

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? ConnectedAt { get; private set; }
    public DateTime? LastUsedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private QasroIntegration() { }

    /// <summary>Creates the integration in "connecting" state and returns the plaintext key, which
    /// the caller sends to Qasro directly — never to the browser.</summary>
    public static (QasroIntegration Integration, string ApiKey) Create()
    {
        var integration = new QasroIntegration();
        var key = integration.RotateKey();
        return (integration, key);
    }

    public string RotateKey()
    {
        var raw = KeyPrefix + Base64Url(RandomNumberGenerator.GetBytes(32));
        KeyHash = Hash(raw);
        KeyHint = raw[..(KeyPrefix.Length + 4)];
        UpdatedAt = DateTime.UtcNow;
        return raw;
    }

    public void MarkConnected(string qasroAgencyId)
    {
        QasroAgencyId = qasroAgencyId;
        Status = "connected";
        LastError = null;
        ConnectedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkError(string error)
    {
        Status = "error";
        LastError = error.Length > 500 ? error[..500] : error;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Disconnect()
    {
        Status = "disconnected";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Touch()
    {
        LastUsedAt = DateTime.UtcNow;
    }

    public static string Hash(string apiKey) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(apiKey))).ToLowerInvariant();

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
