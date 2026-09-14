using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Handlers.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;

/// <summary>
/// Resolves the agent holding a Bayut / dubizzle listing, so a WhatsApp push — which names no
/// agent at all — can still reach the right person.
///
/// <para><b>This talks to a third-party listing-lookup service, not to Bayut.</b> Bayut publishes
/// no endpoint that maps a listing to its agent; their own API returns enquiries, and the agent is
/// only learned once one arrives. Services such as bayutapi.com read the public listing page and
/// expose it as JSON. That is why it is <b>off unless a tenant enters a key</b>: it is an external
/// dependency in the assignment path, and nobody should acquire one by upgrading.</para>
///
/// <para>Two calls per listing: the listing gives the agent's id and name, the agent profile gives
/// their contact details. Cached hard — a listing does not change hands often, and a portal can
/// send many enquiries on one property in a day.</para>
/// </summary>
public sealed class BayutListingAgentDirectory(
    CrmDbContext db,
    IHttpClientFactory httpFactory,
    ISecretProtector protector,
    IMemoryCache cache,
    ILogger<BayutListingAgentDirectory> logger) : IPortalListingDirectory
{
    public const string HttpClientName = "bayut-listing-lookup";

    /// <summary>Credential field holding the lookup service's API key. Absent = feature off.</summary>
    public const string ApiKeyField = "listingLookupKey";

    /// <summary>Credential field overriding the service base URL, for a different vendor or host.</summary>
    public const string BaseUrlField = "listingLookupBaseUrl";

    public const string DefaultBaseUrl = "https://bayutapi.com";

    /// <summary>A listing keeps its agent for months; re-reading it per enquiry would be waste.</summary>
    private static readonly TimeSpan FoundTtl = TimeSpan.FromHours(24);

    /// <summary>
    /// Misses expire sooner than hits. "Not found" is often temporary — an unconfigured key, a
    /// rate limit, a listing not yet indexed — and caching that for a day would hide the fix.
    /// </summary>
    private static readonly TimeSpan MissTtl = TimeSpan.FromHours(1);

    public bool Handles(string providerKey) =>
        providerKey is "bayut" or "dubizzle";

    public async Task<PortalAgent?> FindListingAgentAsync(
        Guid integrationId, string providerKey, string listingId, CancellationToken ct)
    {
        if (!Handles(providerKey)) return null;

        // The service addresses listings by their numeric id. A Bayut REFERENCE ("100104-uDkDxP")
        // is an account-level code it knows nothing about, so passing one would be a guaranteed
        // miss dressed up as a lookup.
        if (!listingId.All(char.IsAsciiDigit)) return null;

        var key = $"bayut-listing-agent:{integrationId}:{listingId}";
        if (cache.TryGetValue<PortalAgent?>(key, out var cached)) return cached;

        PortalAgent? agent = null;
        try
        {
            var integration = await db.Integrations.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == integrationId && !i.IsDeleted, ct);
            var (apiKey, baseUrl) = ReadCredentials(integration);
            if (apiKey is not null) agent = await LookupAsync(baseUrl, apiKey, listingId, ct);
        }
        catch (Exception ex)
        {
            // Fail-soft: the lead is still created and routed by the normal rules.
            logger.LogWarning(ex, "Listing lookup failed for listing {Listing} on integration {Integration}.",
                listingId, integrationId);
        }

        cache.Set(key, agent, agent is null ? MissTtl : FoundTtl);
        return agent;
    }

    private (string? ApiKey, string BaseUrl) ReadCredentials(Integration? integration)
    {
        if (integration?.Credentials is not { Length: > 0 } encrypted) return (null, DefaultBaseUrl);
        try
        {
            var json = protector.Unprotect(encrypted);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string? Field(string name) =>
                root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
                && v.GetString() is { Length: > 0 } s ? s.Trim() : null;

            return (Field(ApiKeyField), Field(BaseUrlField) ?? DefaultBaseUrl);
        }
        catch { return (null, DefaultBaseUrl); }
    }

    private async Task<PortalAgent?> LookupAsync(string baseUrl, string apiKey, string listingId, CancellationToken ct)
    {
        var property = await GetAsync(baseUrl, apiKey, $"/property/{listingId}", ct);
        if (property is not { } prop) return null;

        if (!prop.TryGetProperty("agent", out var agentEl) || agentEl.ValueKind != JsonValueKind.Object)
            return null;

        var agentId = Num(agentEl, "id");
        var name    = Str(agentEl, "name");

        // The listing carries the agent's name but usually not their contact details, so the agent
        // profile is fetched too. A name alone is still worth returning: matching on it is the
        // most person-specific option here (see the matching order in LeadIntakeService).
        string? email = null, phone = null;
        if (agentId is not null && await GetAsync(baseUrl, apiKey, $"/agent/{agentId}", ct) is { } profile)
        {
            name ??= Str(profile, "name");
            if (profile.TryGetProperty("phone_numbers", out var pn) && pn.ValueKind == JsonValueKind.Object)
            {
                email = Str(pn, "email");
                // proxy_* are the portal's MASKED forwarding numbers, shown publicly in place of
                // the agent's own. They identify nobody — several agents share one — so matching
                // on them would assign every lead to whoever happened to hold that number.
                phone = Str(pn, "cell") ?? Str(pn, "whatsapp") ?? Str(pn, "phone");
            }
        }

        if (name is null && email is null && phone is null) return null;
        return new PortalAgent(agentId ?? listingId, name, email, phone);
    }

    private async Task<JsonElement?> GetAsync(string baseUrl, string apiKey, string path, CancellationToken ct)
    {
        var http = httpFactory.CreateClient(HttpClientName);
        using var req = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + path);
        // Sent both ways: these services are commonly fronted by RapidAPI (x-rapidapi-key) or take
        // a plain bearer token, and which one applies is the vendor's choice, not ours.
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        req.Headers.TryAddWithoutValidation("x-rapidapi-key", apiKey);

        using var res = await http.SendAsync(req, ct);
        if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            logger.LogWarning("Listing lookup rejected the API key ({Status}).", (int)res.StatusCode);
            return null;
        }
        if (!res.IsSuccessStatusCode) return null;

        var body = await res.Content.ReadAsStringAsync(ct);
        if (string.IsNullOrWhiteSpace(body)) return null;
        try { return JsonDocument.Parse(body).RootElement.Clone(); }
        catch (JsonException) { return null; }   // an expired key often answers with an HTML page
    }

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
        && v.GetString() is { Length: > 0 } s ? s.Trim() : null;

    private static string? Num(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.Number => v.GetRawText(),
                JsonValueKind.String => v.GetString(),
                _ => null,
            }
            : null;
}
