using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

/// <summary>
/// Resolves a Property Finder <c>publicProfile.id</c> to that agent's name, email and phone by
/// reading the account's own user directory (<c>GET /v1/users</c>).
///
/// <para>A PF enquiry names its agent as a bare number, so without this the only way a lead could
/// reach the right person was for an admin to have mapped that number in the import wizard first.
/// An agent hired after the last import had every lead of theirs round-robined away.</para>
///
/// <para><b>Cached per integration for 10 minutes.</b> The directory changes rarely, whereas leads
/// arrive in bursts — one enquiry per agent per burst would otherwise be a full paged crawl of the
/// account, against an auth endpoint documented at 60 requests a minute.</para>
///
/// <para><b>Negative results are cached too</b>, for the same duration. A profile id that is not in
/// the directory (a deactivated agent, an agency-level enquiry) would otherwise re-crawl the whole
/// account on every single lead it sends.</para>
/// </summary>
public sealed class PropertyFinderAgentDirectory(
    CrmDbContext db,
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore credentials,
    IMemoryCache cache,
    ILogger<PropertyFinderAgentDirectory> logger) : IPortalAgentDirectory
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);

    /// <summary>Paging bound. The account is an agency, not a marketplace — 50 pages is 2,500 agents.</summary>
    private const int MaxPages = 50;

    public bool Handles(string providerKey) =>
        string.Equals(providerKey, PropertyFinderCredentialStore.ProviderKey, StringComparison.OrdinalIgnoreCase);

    public async Task<PortalAgent?> FindAsync(
        Guid integrationId, string providerKey, string agentKey, CancellationToken ct)
    {
        if (!Handles(providerKey)) return null;

        var directory = await GetDirectoryAsync(integrationId, ct);
        return directory is not null && directory.TryGetValue(agentKey, out var agent) ? agent : null;
    }

    private async Task<Dictionary<string, PortalAgent>?> GetDirectoryAsync(Guid integrationId, CancellationToken ct)
    {
        var key = $"pf-agent-directory:{integrationId}";
        if (cache.TryGetValue<Dictionary<string, PortalAgent>?>(key, out var cached)) return cached;

        Dictionary<string, PortalAgent>? result = null;
        try
        {
            // Tracked-entity lookup avoided: this runs inside intake, whose change tracker is about
            // to save a lead, and an integration loaded here must not be modified by accident.
            var integration = await db.Integrations.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == integrationId && !i.IsDeleted, ct);
            var cred = credentials.Read(integration);
            if (cred is not null) result = await CrawlAsync(cred, ct);
        }
        catch (Exception ex)
        {
            // Fail-soft by design: the lead still gets created and routed by the normal rules. The
            // null is cached like any other answer so a broken key cannot turn every inbound
            // enquiry into a failed API crawl.
            logger.LogWarning(ex, "Property Finder agent directory unavailable for integration {Integration}.", integrationId);
        }

        cache.Set(key, result, Ttl);
        return result;
    }

    private async Task<Dictionary<string, PortalAgent>> CrawlAsync(
        PropertyFinderApiClient.Credentials cred, CancellationToken ct)
    {
        var map = new Dictionary<string, PortalAgent>(StringComparer.OrdinalIgnoreCase);

        for (var page = 1; page <= MaxPages; page++)
        {
            var result = await api.GetUsersPageAsync(cred, page, ct);
            foreach (var u in result.Items)
            {
                if (ProfileId(u) is not { } profileId) continue;   // no public profile = never on a lead
                map[profileId] = new PortalAgent(
                    profileId,
                    Str(u, "name") ?? $"{Str(u, "firstName")} {Str(u, "lastName")}".Trim(),
                    Str(u, "email"),
                    // PF spells the number differently across accounts; all the documented spellings
                    // are read rather than assuming one.
                    Str(u, "phone") ?? Str(u, "mobile") ?? Str(u, "phoneNumber") ?? Str(u, "contactNumber"));
            }
            if (result.Items.Count == 0 || page >= result.TotalPages) break;
        }
        return map;
    }

    private static string? ProfileId(JsonElement u) =>
        u.TryGetProperty("publicProfile", out var p) && p.ValueKind == JsonValueKind.Object
        && p.TryGetProperty("id", out var id)
            ? id.ValueKind switch
            {
                JsonValueKind.Number => id.GetRawText(),
                JsonValueKind.String => id.GetString(),
                _ => null,
            }
            : null;

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
        && v.GetString() is { Length: > 0 } s ? s.Trim() : null;
}
