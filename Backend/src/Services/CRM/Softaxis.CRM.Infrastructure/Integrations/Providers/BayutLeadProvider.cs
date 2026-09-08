using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Bayut enquiries → CRM leads, via Bayut's "Leads API".
///
/// <para>Bayut has no self-serve partner API like Property Finder's Atlas Enterprise API (OAuth
/// key/secret, listing lookups, webhook subscription management) — confirmed against Bayut's own
/// HelpCentre: the Leads API is a <b>push</b> mechanism, available only to Profolio™ users, and
/// enabled per account by emailing support@bayut.com with the CRM's inbound URL. There is no
/// published JSON schema — Bayut's team configures the push once the account is enabled, so this
/// provider (like Calendly and Property Finder's own webhook path) is deliberately tolerant of
/// shape rather than coded against a fixed contract. See <see cref="PropertyPortalLeadMapper"/>
/// for the parsing this provider shares with <see cref="DubizzleLeadProvider"/> — Dubizzle
/// Property runs on the same EMPG/Dubizzle Group backend as Bayut and is documented to deliver
/// leads the same way.</para>
///
/// <para>Bayut's Leads API covers six enquiry types: call logs, email leads, phone views, SMS
/// clicks, WhatsApp views and WhatsApp leads — carried in a type/channel field the mapper reads
/// under several likely names and turns into a human label on the lead (<c>FormName</c>/notes).</para>
///
/// <para>Auth: possession of the unguessable inbound URL is the baseline secret, same as every
/// other inbound provider. If the tenant stores a signing secret (should Bayut's integration team
/// offer one), a present signature header is additionally verified; unsigned/unverifiable requests
/// are still accepted on the strength of the inbound key.</para>
/// </summary>
public sealed class BayutLeadProvider : ILeadProvider, IWebhookLeadProvider
{
    public string Key => "bayut";

    public ProviderDescriptor Descriptor => new(
        "bayut", "Bayut", ProviderCategory.RealEstate,
        "Turn Bayut enquiries (call, email, phone view, SMS, WhatsApp) into CRM leads — request the Leads API from Bayut support, then point it at your inbound URL.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        var leads = new List<CanonicalLead>();
        foreach (var (el, json) in ExtractLeads(rawPayload))
            if (PropertyPortalLeadMapper.Map(el, json, "bayut", "Bayut") is { } lead)
                leads.Add(lead);
        return leads;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    /// <summary>
    /// No signature scheme is published for Bayut's Leads API. Common header names are checked in
    /// case Bayut's team (or a middleware forwarding the leads) signs the body; anything else is
    /// accepted on the strength of the unguessable inbound URL, the same posture Property Finder's
    /// and Calendly's providers take when unsigned.
    /// </summary>
    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        var sig = Header(headers, "X-Bayut-Signature")
               ?? Header(headers, "X-Signature")
               ?? Header(headers, "X-Hub-Signature-256")
               ?? Header(headers, "X-Vrodux-Signature");

        if (string.IsNullOrWhiteSpace(sig)) return true;              // unsigned — the inbound key is the secret
        if (string.IsNullOrWhiteSpace(decryptedSecret)) return true;  // nothing to verify against

        var provided = sig.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase) ? sig[7..] : sig;
        var computed = Convert.ToHexString(
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(decryptedSecret), Encoding.UTF8.GetBytes(rawBody)));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided.Trim().ToLowerInvariant()),
            Encoding.UTF8.GetBytes(computed.ToLowerInvariant()));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// <summary>Accepts a single object, a bare array, or a common wrapper key.</summary>
    internal static List<(JsonElement Element, string Json)> ExtractLeads(string rawPayload)
    {
        if (string.IsNullOrWhiteSpace(rawPayload)) return [];
        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement.Clone(); }
        catch { return []; }

        if (root.ValueKind == JsonValueKind.Array)
            return root.EnumerateArray().Select(e => (e.Clone(), e.GetRawText())).ToList();

        if (root.ValueKind != JsonValueKind.Object) return [];

        foreach (var wrapper in new[] { "data", "leads", "items", "results" })
            if (root.TryGetProperty(wrapper, out var arr) && arr.ValueKind == JsonValueKind.Array)
                return arr.EnumerateArray().Select(e => (e.Clone(), e.GetRawText())).ToList();

        return [(root, rawPayload)];
    }

    private static string? Header(IReadOnlyDictionary<string, string> headers, string name) =>
        headers.TryGetValue(name, out var v) ? v : null;
}
