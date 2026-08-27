using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers;

/// <summary>
/// Property Finder enquiries → CRM leads, via the Enterprise API (atlas.propertyfinder.com).
///
/// Both directions are supported and produce identical leads:
///  • <b>Live</b> — PF posts <c>lead.created</c> / <c>lead.assigned</c> to this integration's
///    inbound URL. Deliveries are at-least-once and must be acknowledged within 5 seconds, which
///    the existing store-to-inbox-then-ack flow already satisfies.
///  • <b>Backfill / gap-fill</b> — <see cref="FetchAsync"/> pages the leads endpoint.
///
/// A lead references its listing by id only, so the property title and price require a second
/// lookup. That is why the interesting work happens in <see cref="NormalizeAsync"/> (enriching)
/// rather than the synchronous <see cref="Normalize"/>, which is kept only as the no-network
/// fallback the inbox uses if enrichment fails.
/// </summary>
public sealed class PropertyFinderLeadProvider(PropertyFinderApiClient api, ISecretProtector protector)
    : ILeadProvider, IWebhookLeadProvider, IAsyncLeadProvider, IPollSyncLeadProvider
{
    public string Key => "property-finder";

    public ProviderDescriptor Descriptor => new(
        "property-finder", "Property Finder", ProviderCategory.RealEstate,
        "Sync Property Finder enquiries (WhatsApp, phone call, email) into the CRM — with the property, price and owning agent attached.",
        ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey | ProviderCapabilities.ApiKey | ProviderCapabilities.PollSync);

    // ── Synchronous fallback (no enrichment) ────────────────────────────────────

    public IReadOnlyList<CanonicalLead> Normalize(string rawPayload, Integration integration)
    {
        foreach (var (el, json) in ExtractLeads(rawPayload, out _))
            if (PropertyFinderLeadMapper.Map(el, null, json) is { } lead)
                return [lead];
        return [];
    }

    // ── Enriched path — used by the inbox processor ─────────────────────────────

    public async Task<IReadOnlyList<CanonicalLead>> NormalizeAsync(
        string rawPayload, Integration integration, CancellationToken ct)
    {
        var items = ExtractLeads(rawPayload, out var isReassignment);
        if (items.Count == 0) return [];

        var cred = ResolveCredentials(integration);
        var listings = new Dictionary<string, PropertyFinderLeadMapper.ListingInfo>(StringComparer.OrdinalIgnoreCase);

        if (cred is not null)
        {
            var ids = items.Select(x => PropertyFinderLeadMapper.ListingId(x.Element))
                           .Where(id => id is not null).Select(id => id!).Distinct().ToList();
            if (ids.Count > 0)
            {
                // Enrichment must never cost us the lead: a deleted listing, a missing scope or a
                // slow API is a reason to store a thinner lead, not to drop the enquiry.
                try
                {
                    foreach (var l in await api.GetListingsByIdsAsync(cred, ids, ct))
                        if (PropertyFinderLeadMapper.ParseListing(l) is { } info)
                            listings[info.Id] = info;
                }
                catch (PropertyFinderApiException) { /* fall through unenriched */ }
            }
        }

        var leads = new List<CanonicalLead>(items.Count);
        foreach (var (el, json) in items)
        {
            var listingId = PropertyFinderLeadMapper.ListingId(el);
            var info = listingId is not null && listings.TryGetValue(listingId, out var v) ? v : null;
            if (PropertyFinderLeadMapper.Map(el, info, json) is { } lead)
            {
                lead.IsReassignment = isReassignment;
                leads.Add(lead);
            }
        }
        return leads;
    }

    // ── Poll sync — gap-fill behind the webhook ─────────────────────────────────

    /// <summary>
    /// Leads created since the integration's last successful sync.
    ///
    /// The API rejects a <c>createdAtFrom</c> older than 3 months, so a long-dormant integration
    /// clamps to that window rather than sending a value that would 400. That is safe here because
    /// polling is only ever the gap-filler behind the webhook — the full history is loaded once by
    /// the backfill, which pages without a date filter.
    /// </summary>
    public async Task<IReadOnlyList<CanonicalLead>> FetchAsync(Integration integration, CancellationToken ct)
    {
        var cred = ResolveCredentials(integration);
        if (cred is null) return [];

        var floor = DateTime.UtcNow.AddDays(-89);
        var since = integration.LastSuccessAt is { } last && last > floor ? last.AddMinutes(-5) : floor;

        var raw = new List<(JsonElement Element, string Json)>();
        for (var page = 1; ; page++)
        {
            var result = await api.GetLeadsPageAsync(cred, page, since, ct);
            raw.AddRange(result.Items.Select(i => (i, i.GetRawText())));
            if (page >= result.TotalPages || result.Items.Count == 0) break;
        }
        if (raw.Count == 0) return [];

        var listings = await LoadListingsAsync(cred, raw.Select(r => r.Element), ct);

        var leads = new List<CanonicalLead>(raw.Count);
        foreach (var (el, json) in raw)
        {
            var lid  = PropertyFinderLeadMapper.ListingId(el);
            var info = lid is not null && listings.TryGetValue(lid, out var v) ? v : null;
            if (PropertyFinderLeadMapper.Map(el, info, json) is { } lead) leads.Add(lead);
        }
        return leads;
    }

    internal async Task<Dictionary<string, PropertyFinderLeadMapper.ListingInfo>> LoadListingsAsync(
        PropertyFinderApiClient.Credentials cred, IEnumerable<JsonElement> leads, CancellationToken ct)
    {
        var map = new Dictionary<string, PropertyFinderLeadMapper.ListingInfo>(StringComparer.OrdinalIgnoreCase);
        var ids = leads.Select(PropertyFinderLeadMapper.ListingId)
                       .Where(id => id is not null).Select(id => id!).Distinct().ToList();
        if (ids.Count == 0) return map;
        try
        {
            foreach (var l in await api.GetListingsByIdsAsync(cred, ids, ct))
                if (PropertyFinderLeadMapper.ParseListing(l) is { } info) map[info.Id] = info;
        }
        catch (PropertyFinderApiException) { /* unenriched is acceptable */ }
        return map;
    }

    // ── Webhook capability ──────────────────────────────────────────────────────

    public string? TryHandleVerification(IReadOnlyDictionary<string, string> query, Integration integration) => null;

    /// <summary>
    /// Property Finder signs the full event payload with HMAC-SHA256 and sends the result in
    /// <c>X-Signature</c> as a <b>bare hex string</b> — no "sha256=" prefix, unlike Meta and
    /// Calendly. The prefix is still tolerated so a proxy that adds one does not break delivery.
    /// </summary>
    public bool VerifySignature(string rawBody, IReadOnlyDictionary<string, string> headers, string? decryptedSecret)
    {
        var sig = Header(headers, "X-Signature")
               ?? Header(headers, "X-PropertyFinder-Signature")
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

    // ── helpers ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// The API key belongs to the tenant that owns this integration, and is stored encrypted on
    /// it — never read from shared configuration, which every tenant would share.
    /// </summary>
    private PropertyFinderApiClient.Credentials? ResolveCredentials(Integration integration)
    {
        if (integration.Credentials is not { Length: > 0 } encrypted) return null;
        try
        {
            var root = JsonDocument.Parse(protector.Unprotect(encrypted)).RootElement;
            return PropertyFinderApiClient.BuildCredentials(
                root.TryGetProperty("apiKey", out var k) ? k.GetString() : null,
                root.TryGetProperty("apiSecret", out var s) ? s.GetString() : null);
        }
        catch { return null; }   // unreadable ciphertext = treat as not configured
    }
    /// <summary>
    /// A webhook delivery wraps the lead in an event envelope; the API returns bare lead objects.
    /// Accept both, plus a bare array, so the same provider serves every path.
    /// </summary>
    private static List<(JsonElement Element, string Json)> ExtractLeads(string rawPayload, out bool isReassignment)
    {
        isReassignment = false;
        if (string.IsNullOrWhiteSpace(rawPayload)) return [];
        JsonElement root;
        try { root = JsonDocument.Parse(rawPayload).RootElement.Clone(); }
        catch { return []; }

        if (root.ValueKind == JsonValueKind.Array)
            return root.EnumerateArray().Select(e => (e.Clone(), e.GetRawText())).ToList();

        if (root.ValueKind != JsonValueKind.Object) return [];

        // Webhook envelope: { id, type, timestamp, entity: { id, type: "lead" }, payload: { … } }.
        // The payload carries the lead fields but not the lead id — that lives on `entity.id`, and
        // it is what dedupe keys on, so the two have to be recombined.
        // lead.assigned carries the same lead id as lead.created, so without reading the event
        // type a reassignment is indistinguishable from a duplicate and ownership never moves.
        if (root.TryGetProperty("type", out var evt) && evt.ValueKind == JsonValueKind.String)
            isReassignment = string.Equals(evt.GetString(), "lead.assigned", StringComparison.OrdinalIgnoreCase);

        if (root.TryGetProperty("payload", out var payload) && payload.ValueKind == JsonValueKind.Object)
        {
            var merged = new Dictionary<string, JsonElement>();
            foreach (var p in payload.EnumerateObject()) merged[p.Name] = p.Value;
            if (root.TryGetProperty("entity", out var entity) && entity.ValueKind == JsonValueKind.Object &&
                entity.TryGetProperty("id", out var eid))
                merged["id"] = eid;
            if (!merged.ContainsKey("createdAt") && root.TryGetProperty("timestamp", out var ts))
                merged["createdAt"] = ts;

            var json = JsonSerializer.Serialize(merged.ToDictionary(k => k.Key, v => (object?)v.Value));
            var el   = JsonDocument.Parse(json).RootElement.Clone();
            return [(el, rawPayload)];
        }

        foreach (var wrapper in new[] { "data", "leads", "items", "results" })
            if (root.TryGetProperty(wrapper, out var arr) && arr.ValueKind == JsonValueKind.Array)
                return arr.EnumerateArray().Select(e => (e.Clone(), e.GetRawText())).ToList();

        return [(root, rawPayload)];
    }

    private static string? Header(IReadOnlyDictionary<string, string> headers, string name) =>
        headers.TryGetValue(name, out var v) ? v : null;
}
