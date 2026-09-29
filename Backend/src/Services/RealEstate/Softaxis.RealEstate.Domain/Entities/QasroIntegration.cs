using System.Security.Cryptography;
using System.Text;

namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// A workspace's connection to Qasro (qasro.com) — Softaxis's sister property portal.
///
/// Established via real OAuth against Qasro's own login/signup, gated by Qasro's own
/// agency-approval status — not a blind server-to-server push. See IQasroClient's remarks for the
/// full handshake. The tenant never sees or manages a key: it is generated here only after Qasro
/// confirms approval, and handed to Qasro server-to-server for its own pull — there is nowhere for
/// a tenant to paste it, unlike the "own website" integration's key.
///
/// One per workspace (tenant-unique index, same as WebsiteIntegration). The key itself is never
/// stored — only its SHA-256 hash — so a database leak cannot be used to impersonate Qasro's pull.
/// </summary>
public sealed class QasroIntegration
{
    public const string KeyPrefix = "vrx_qasro_";

    /// <summary>Fixed value for WebsiteClientDto.WebsiteOrigin when a Qasro-presented key resolves
    /// — display-only, unrelated to QasroOptions.SiteUrl (which drives the actual OAuth redirect).</summary>
    public const string Origin = "https://qasro.com";

    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>Qasro's own id for the agency record, known once the OAuth handshake confirms
    /// approval. Used to address Qasro when registering the pull key and on disconnect.</summary>
    public string? QasroAgencyId { get; private set; }

    /// <summary>Null until the OAuth handshake actually confirms approval — see the class remarks
    /// and RotateKey. A "connecting" row genuinely has no key yet, not an empty placeholder one.</summary>
    public string? KeyHash { get; private set; }

    /// <summary>Never shown to the tenant (there is nothing for them to paste it into) — kept only
    /// so a support engineer can confirm which key a failed sync attempt used.</summary>
    public string? KeyHint { get; private set; }

    /// <summary>connecting | connected | error | disconnected. "Connecting" is the state between
    /// starting the OAuth redirect and Qasro's callback confirming (or refusing) approval.</summary>
    public string Status { get; private set; } = "connecting";

    public string? LastError { get; private set; }

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? ConnectedAt { get; private set; }
    public DateTime? LastUsedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private QasroIntegration() { }

    /// <summary>Starts a fresh handshake — no key, no agency id yet. Those only exist once Qasro's
    /// OAuth callback confirms the agency is approved (see QasroOAuthCallbackHandler).</summary>
    public static QasroIntegration CreateConnecting() => new();

    /// <summary>Generates (or replaces) the local pull key. Only called once approval is confirmed
    /// — see the class remarks on why "connecting" genuinely has no key.</summary>
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
