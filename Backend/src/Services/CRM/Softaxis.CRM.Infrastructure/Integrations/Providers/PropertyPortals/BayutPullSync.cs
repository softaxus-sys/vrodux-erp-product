using System.Text.Json;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// The poll-sync sweep shared by Bayut and Dubizzle — identical API, different host and label.
/// </summary>
internal static class BayutPullSync
{
    /// <summary>
    /// How far back a never-synced (or long-dormant) integration reaches on its first sweep.
    ///
    /// <para>The API has no paging and no documented result cap, so a wide window is a request for
    /// an unbounded response. Seven days is enough to cover a restart or a weekend outage without
    /// asking the portal for a year of history — a genuine backfill is a deliberate act, not
    /// something a background poll should trigger on its own.</para>
    /// </summary>
    private static readonly TimeSpan ColdStartWindow = TimeSpan.FromDays(7);

    /// <summary>
    /// Overlap re-requested on every sweep. `timestamp` filters on the portal's clock, and neither
    /// the request nor the response states a timezone, so a small rewind costs a few duplicates
    /// (which dedupe on lead_id) and avoids the far worse failure of skipping leads.
    /// </summary>
    private static readonly TimeSpan Overlap = TimeSpan.FromMinutes(30);

    public static async Task<IReadOnlyList<CanonicalLead>> FetchAsync(
        BayutPullApiClient api, ISecretProtector protector, Integration integration,
        string baseUrl, string platformKey, string platformLabel, CancellationToken ct)
    {
        var apiKey = ResolveApiKey(protector, integration);
        if (string.IsNullOrWhiteSpace(apiKey)) return [];

        var since = integration.LastSuccessAt is { } last
            ? last - Overlap
            : DateTime.UtcNow - ColdStartWindow;

        // Keyed by Bayut's lead_id so the same enquiry cannot arrive twice from two slices. Leads
        // without one still pass through — the intake service dedupes those on email/phone.
        var byId = new Dictionary<string, CanonicalLead>(StringComparer.OrdinalIgnoreCase);
        var unkeyed = new List<CanonicalLead>();

        void Collect(IEnumerable<JsonElement> items, string typeLabel)
        {
            foreach (var el in items)
            {
                var lead = PropertyPortalLeadMapper.Map(el, el.GetRawText(), platformKey, platformLabel, typeLabel);
                if (lead is null) continue;   // a views row, or an enquiry with no contact detail
                if (lead.ExternalLeadId is { Length: > 0 } id) byId[id] = lead;
                else unkeyed.Add(lead);
            }
        }

        foreach (var (type, target, label) in BayutPullApiClient.LeadQueries)
            Collect(await api.GetLeadsAsync(baseUrl, apiKey!, type, target, since, ct), label);

        Collect(await api.GetCallLogsAsync(baseUrl, apiKey!, since, ct), "Phone call");
        Collect(await api.GetStoryLeadsAsync(baseUrl, apiKey!, since, ct), "WhatsApp lead");

        return [.. byId.Values, .. unkeyed];
    }

    /// <summary>
    /// The pull key belongs to the tenant that owns this integration and is stored encrypted on it.
    /// Never read from shared configuration: one deployment serves many agencies, and a shared key
    /// would pull another agency's enquiries into this tenant's CRM.
    /// </summary>
    private static string? ResolveApiKey(ISecretProtector protector, Integration integration)
    {
        if (integration.Credentials is not { Length: > 0 } encrypted) return null;
        try
        {
            var root = JsonDocument.Parse(protector.Unprotect(encrypted) ?? "{}").RootElement;
            foreach (var name in new[] { "pullApiKey", "apiKey", "pull_key" })
                if (root.TryGetProperty(name, out var v) && v.GetString() is { Length: > 0 } key)
                    return key.Trim();
            return null;
        }
        catch { return null; }   // unreadable ciphertext = treat as not configured
    }
}
