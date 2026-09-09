using System.Security.Cryptography;
using System.Text;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// Verification for Bayut / Dubizzle push deliveries.
///
/// <para>Bayut's Push API documentation states the scheme exactly:
/// <c>X-Bayut-Signature: md5($secret_key . $body)</c> — a plain MD5 of the concatenated secret and
/// raw body, hex, <b>not</b> an HMAC. This code previously computed HMAC-SHA256, which passed only
/// because it is skipped when no secret is stored; the moment a tenant saved the real secret,
/// every genuine lead would have been rejected.</para>
///
/// <para>MD5 is weak, and this is a keyed-prefix construction vulnerable to length extension. That
/// is Bayut's choice, not ours — the alternative is refusing the integration. The unguessable
/// inbound URL remains the primary secret, exactly as for the unsigned providers.</para>
/// </summary>
internal static class PropertyPortalSignature
{
    /// <summary>Header names checked, in order. Dubizzle's docs reuse Bayut's header.</summary>
    private static readonly string[] Headers =
        ["X-Bayut-Signature", "X-Dubizzle-Signature", "X-Signature", "X-Vrodux-Signature"];

    public static bool Verify(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        string? sig = null;
        foreach (var name in Headers)
            if (headers.TryGetValue(name, out var v) && !string.IsNullOrWhiteSpace(v)) { sig = v; break; }

        if (string.IsNullOrWhiteSpace(sig)) return true;              // unsigned — the inbound key is the secret
        if (string.IsNullOrWhiteSpace(decryptedSecret)) return true;  // nothing to verify against

        var computed = Convert.ToHexString(
            MD5.HashData(Encoding.UTF8.GetBytes(decryptedSecret + rawBody)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(sig.Trim().ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }
}
