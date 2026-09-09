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
public sealed class BayutLeadProvider(BayutPullApiClient api, ISecretProtector protector)
    : ILeadProvider, IWebhookLeadProvider, IPollSyncLeadProvider, IBackfillLeadProvider
{
    public string Key => "bayut";

    public ProviderDescriptor Descriptor => new(
        "bayut", "Bayut", ProviderCategory.RealEstate,
        "Turn Bayut enquiries (call, email, phone view, SMS, WhatsApp) into CRM leads — request the Leads API from Bayut support, then point it at your inbound URL.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey
        | ProviderCapabilities.ApiKey | ProviderCapabilities.PollSync);

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        var leads = new List<CanonicalLead>();
        foreach (var (el, json) in ExtractLeads(rawPayload))
            // Every documented push payload is a WhatsApp enquiry, and none of them carries a
            // type field — without this the lead reads as a generic "enquiry" and its number is
            // never marked WhatsApp-reachable.
            if (PropertyPortalLeadMapper.Map(el, json, "bayut", "Bayut", "WhatsApp lead") is { } lead)
                leads.Add(lead);
        return leads;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    /// <inheritdoc cref="PropertyPortalSignature"/>
    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret) =>
        PropertyPortalSignature.Verify(rawBody, headers, decryptedSecret);

    // ── Poll sync — the Pull API ────────────────────────────────────────────────

    /// <summary>
    /// Enquiries from Bayut's Pull API. Unlike the push path this needs no enablement from Bayut's
    /// side beyond the key itself, and it covers every enquiry type including call logs.
    /// </summary>
    public Task<IReadOnlyList<CanonicalLead>> FetchAsync(Integration integration, CancellationToken ct) =>
        BayutPullSync.FetchAsync(api, protector, integration,
            BayutPullApiClient.BayutBaseUrl, "bayut", "Bayut", ct);


    // ── Backfill — a one-off catch-up over an explicit window ───────────────────

    /// <inheritdoc />
    public TimeSpan? MaxBackfillAge => BayutPullSync.MaxHistory;

    /// <inheritdoc />
    public Task<IReadOnlyList<CanonicalLead>> FetchSinceAsync(Integration integration, DateTime since, CancellationToken ct) =>
        BayutPullSync.FetchSinceAsync(api, protector, integration,
            BayutPullApiClient.BayutBaseUrl, "bayut", "Bayut", since, ct);

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
