using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Application.PropertyFinderImport.Commands;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.PropertyFinderImport;

internal sealed class ImportPropertyFinderLeadsHandler(
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore credentials,
    ILeadIntakeService intake,
    CrmDbContext db,
    IMemoryCache cache,
    ILogger<ImportPropertyFinderLeadsHandler> logger)
    : ICommandHandler<ImportPropertyFinderLeadsCommand, PfLeadImportResultDto>
{
    public async Task<Result<PfLeadImportResultDto>> Handle(ImportPropertyFinderLeadsCommand cmd, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<PfLeadImportResultDto>(Error.Custom(
                "PropertyFinder.NoTenant", "No tenant could be resolved from the request."));

        // This tenant's own key — never a shared one. See PropertyFinderCredentialStore.
        var integration = await credentials.FindIntegrationAsync(ct);
        var cred = credentials.Read(integration);
        if (cred is null)
            return Result.Failure<PfLeadImportResultDto>(Error.Custom(
                "PropertyFinder.NotConfigured", "Property Finder is not connected for this workspace. Connect it under Settings → Integrations and enter this agency's own API key and secret."));

        // ── The import plan: every enquiry, grouped into people, in a stable order ──
        //
        // Cached between batches. Rebuilding it per batch would mean re-paging all 140 pages of
        // enquiries every time — thousands of wasted API calls against a shared rate limit — and,
        // worse, a plan that could shift between batches and silently skip or repeat people.
        var plan = await GetOrBuildPlanAsync(cred, tenantId, ct);
        if (plan.Failure is { } planError)
            return Result.Failure<PfLeadImportResultDto>(planError);

        var byProfile = cmd.Assignments.ToDictionary(a => a.PublicProfileId);

        // Persist the agent map onto the integration, so leads arriving LIVE reach the same person
        // the import would have given them to. Without it a webhook lead falls back to routing
        // config, which can only name someone — the enquiry would land on whoever is next in the
        // pool rather than the agent Property Finder actually assigned it to.
        if (!cmd.DryRun && cmd.Assignments.Count > 0)
            await PersistAgentMapAsync(integration, cmd.Assignments, ct);

        var result = new Counters();
        var errors = new List<string>();

        var take  = Math.Clamp(cmd.Take, 1, 1000);
        var slice = plan.People.Skip(cmd.Skip).Take(take).ToList();

        foreach (var enquiries in slice)
        {
            ct.ThrowIfCancellationRequested();

            // Newest first: the most recent enquiry is the live one, and its agent is who should
            // own the person now. Older enquiries become history on the same lead.
            enquiries.Sort((a, b) => string.CompareOrdinal(Created(b), Created(a)));
            var primary = enquiries[0];

            var owner = ResolveOwner(primary, byProfile, cmd);
            if (owner is null) result.Unassigned++;

            var listingId = PropertyFinderLeadMapper.ListingId(primary);
            var info = listingId is not null && plan.Listings.TryGetValue(listingId, out var li) ? li : null;
            var canonical = PropertyFinderLeadMapper.Map(primary, info, primary.GetRawText());
            if (canonical is null) continue;

            // The count of prior enquiries is the strongest intent signal this source has — someone
            // who has enquired five times is not the same lead as a single tap — so it is carried
            // into the lead rather than living only in the activity list.
            if (enquiries.Count > 1)
                canonical.RawFields["enquiry_count"] = enquiries.Count.ToString();

            result.People++;
            if (cmd.DryRun) { result.Created++; continue; }

            IntakeResult outcome;
            try
            {
                // Passing the integration is not cosmetic. It sets Lead.Source to "property-finder"
                // instead of the generic "integration" — which is what every source-based report
                // groups by — and it supplies the provider key that external-id dedupe REQUIRES.
                // Without it a re-run cannot recognise an enquiry it has already imported, matches
                // on phone instead, and records each one as a fresh repeat contact.
                outcome = await intake.IngestAsync(canonical, tenantId, integration, ct, owner);
            }
            catch (Exception ex)
            {
                result.Failed++;
                if (errors.Count < 50) errors.Add($"{canonical.Phone ?? canonical.Email}: {ex.Message}");
                continue;
            }

            switch (outcome.Outcome)
            {
                case IntakeOutcome.Created:   result.Created++;    break;
                // Re-running the import: the person is already here, so the enquiry was added to
                // their timeline instead of creating a second lead.
                case IntakeOutcome.Updated:
                case IntakeOutcome.Duplicate: result.Duplicates++; break;
                default:
                    result.Failed++;
                    if (errors.Count < 50) errors.Add($"{canonical.Phone ?? canonical.Email}: {outcome.Message}");
                    continue;
            }

            // Enquiry history — every earlier contact from this person, on the lead's timeline.
            if (outcome.LeadId is { } leadId && enquiries.Count > 1)
                result.Enquiries += await LogEnquiryHistoryAsync(
                    leadId, canonical.FullName, enquiries.Skip(1), plan.Listings, owner, tenantId, ct);
        }

        var nextSkip = cmd.Skip + slice.Count;
        return Result.Success(new PfLeadImportResultDto(
            LeadsFetched:    plan.TotalEnquiries,
            PeopleImported:  result.People,
            Created:         result.Created,
            Duplicates:      result.Duplicates,
            Failed:          result.Failed,
            EnquiriesLogged: result.Enquiries,
            Unassigned:      result.Unassigned,
            Errors:          errors,
            TotalPeople:     plan.People.Count,
            NextSkip:        nextSkip,
            HasMore:         nextSkip < plan.People.Count));
    }

    // ── Live-sync ownership ─────────────────────────────────────────────────────

    /// <summary>
    /// Writes the Property Finder agent → Vrodux user map into the integration's routing config,
    /// under the generic <c>external_map</c> mode the intake pipeline understands.
    ///
    /// <para>Merged rather than replaced: a second import of a subset of agents must not wipe the
    /// mapping for everyone else, which would silently send their live leads back to round-robin.</para>
    /// </summary>
    private async Task PersistAgentMapAsync(
        Integration? integration, IReadOnlyList<PfAgentAssignment> assignments, CancellationToken ct)
    {
        if (integration is null) return;   // not connected yet — the backfill still works

        var map = new Dictionary<string, object>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(integration.RoutingConfig))
        {
            try
            {
                var root = JsonDocument.Parse(integration.RoutingConfig).RootElement;
                if (root.TryGetProperty("externalMap", out var existing) && existing.ValueKind == JsonValueKind.Object)
                    foreach (var e in existing.EnumerateObject())
                        map[e.Name] = JsonSerializer.Deserialize<object>(e.Value.GetRawText())!;
            }
            catch { /* unreadable config is replaced rather than allowed to block the import */ }
        }

        foreach (var a in assignments)
            map[a.PublicProfileId.ToString()] = new
            {
                userId   = a.UserId.ToString(),
                userName = a.UserName,
                teamId   = a.TeamId?.ToString(),
            };

        integration.SetRoutingConfig(JsonSerializer.Serialize(new { mode = "external_map", externalMap = map }));
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Property Finder: {Count} agent(s) mapped for live lead assignment.", map.Count);
    }

    // ── The import plan ─────────────────────────────────────────────────────────

    /// <summary>
    /// Every enquiry from Property Finder, grouped into people and ordered stably, plus the
    /// listing details used to enrich them.
    /// </summary>
    private sealed record ImportPlan(
        List<List<JsonElement>> People,
        Dictionary<string, PropertyFinderLeadMapper.ListingInfo> Listings,
        int TotalEnquiries,
        Error? Failure = null);

    /// <summary>Held only long enough to finish an import that is already under way.</summary>
    private static readonly TimeSpan PlanLifetime = TimeSpan.FromMinutes(30);

    private async Task<ImportPlan> GetOrBuildPlanAsync(
        PropertyFinderApiClient.Credentials cred, Guid tenantId, CancellationToken ct)
    {
        var key = $"pf-import-plan:{tenantId}";
        if (cache.TryGetValue<ImportPlan>(key, out var cached) && cached is not null) return cached;

        // Deliberately unfiltered: createdAtFrom cannot be older than 3 months, but plain paging
        // returns the whole history, which is what a backfill needs.
        var raw = new List<JsonElement>();
        try
        {
            for (var page = 1; ; page++)
            {
                var p = await api.GetLeadsPageAsync(cred, page, null, ct);
                raw.AddRange(p.Items);
                if (page >= p.TotalPages || p.Items.Count == 0) break;
            }
        }
        catch (PropertyFinderApiException ex)
        {
            return new ImportPlan([], [], 0, Error.Custom("PropertyFinder.Failed", ex.Message));
        }

        // Listing enrichment (title + price -> Interested in / Budget).
        var listings = new Dictionary<string, PropertyFinderLeadMapper.ListingInfo>(StringComparer.OrdinalIgnoreCase);
        var listingIds = raw.Select(PropertyFinderLeadMapper.ListingId)
                            .Where(x => x is not null).Select(x => x!).Distinct().ToList();
        if (listingIds.Count > 0)
        {
            try
            {
                foreach (var l in await api.GetListingsByIdsAsync(cred, listingIds, ct))
                    if (PropertyFinderLeadMapper.ParseListing(l) is { } info) listings[info.Id] = info;
            }
            catch (PropertyFinderApiException ex)
            {
                // A thinner import beats no import — the enquiries themselves are already in hand.
                logger.LogWarning(ex, "Property Finder listing enrichment failed; importing without property details.");
            }
        }

        var groups = new Dictionary<string, List<JsonElement>>(StringComparer.OrdinalIgnoreCase);
        foreach (var lead in raw)
        {
            var idKey = IdentityKey(lead);
            if (idKey is null) continue;                     // no contact at all — unworkable
            if (!groups.TryGetValue(idKey, out var list)) groups[idKey] = list = [];
            list.Add(lead);
        }

        // Ordered by the identity key so the slices are stable: an unordered dictionary could
        // enumerate differently between batches, quietly skipping some people and repeating others.
        var people = groups.OrderBy(g => g.Key, StringComparer.Ordinal)
                           .Select(g => g.Value)
                           .ToList();

        var plan = new ImportPlan(people, listings, raw.Count);
        cache.Set(key, plan, PlanLifetime);
        return plan;
    }
    // ── Enquiry history ─────────────────────────────────────────────────────────

    /// <summary>
    /// Writes each earlier enquiry as a completed <c>note</c> activity on the lead, so the drawer's
    /// timeline shows what was actually lost by merging: which property, which agent, which channel
    /// and when. Recorded as notes rather than tasks because they are history, not work to do.
    /// </summary>
    private async Task<int> LogEnquiryHistoryAsync(
        Guid leadId, string? leadName, IEnumerable<JsonElement> older,
        IReadOnlyDictionary<string, PropertyFinderLeadMapper.ListingInfo> listings,
        LeadOwner? owner, Guid tenantId, CancellationToken ct)
    {
        var added = 0;
        foreach (var e in older)
        {
            var listingId = PropertyFinderLeadMapper.ListingId(e);
            var info = listingId is not null && listings.TryGetValue(listingId, out var li) ? li : null;

            var channel = Str(e, "channel") switch
            {
                "whatsapp" => "WhatsApp enquiry",
                "call"     => "Phone enquiry",
                "email"    => "Email enquiry",
                _          => "Enquiry",
            };

            var subject = info?.Title is { Length: > 0 } t
                ? $"{channel} — {Truncate(t, 90)}"
                : channel;

            var body = new StringBuilder();
            void Line(string k, string? v) { if (!string.IsNullOrWhiteSpace(v)) body.Append(k).Append(": ").Append(v).Append('\n'); }
            Line("Date", Created(e));
            Line("Property", info?.Title);
            Line("Reference", info?.Reference);
            Line("Property Finder lead", Str(e, "id"));
            if (e.TryGetProperty("call", out var call) && call.ValueKind == JsonValueKind.Object)
            {
                Line("Call duration", call.TryGetProperty("talkTime", out var tt) && tt.ValueKind == JsonValueKind.Number
                    ? $"{tt.GetRawText()}s" : null);
                Line("Recording", Str(call, "recordFile"));
            }

            // Clipped to the column widths in CrmConfigurations. A listing title or a call-recording
            // URL is someone else's data and can be any length; SQL Server's truncation error fails
            // the whole batch, so one long title would abandon an entire slice of the import.
            var activity = new Activity(
                type:          "note",
                subject:       Clip(subject, 300) ?? "Enquiry",
                description:   Clip(body.Length > 0 ? body.ToString().TrimEnd() : null, 2000),
                relatedToType: "lead",
                relatedToId:   leadId,
                relatedToName: Clip(leadName, 200),
                dueDate:       null,
                assignedTo:    Clip(owner?.UserName, 200) ?? "");

            // Same reason the intake service stamps explicitly: this can run without an ambient
            // tenant, and an unstamped row is invisible to the tenant that owns it.
            db.Entry(activity).Property(TenantIsolation.Column).CurrentValue = tenantId;
            db.Activities.Add(activity);
            added++;
        }

        if (added > 0) await db.SaveChangesAsync(ct);
        return added;
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private static LeadOwner? ResolveOwner(
        JsonElement lead, IReadOnlyDictionary<int, PfAgentAssignment> byProfile,
        ImportPropertyFinderLeadsCommand cmd)
    {
        if (PropertyFinderLeadMapper.ProfileId(lead) is { } pid && byProfile.TryGetValue(pid, out var a))
            // The agent's own team wins; the import-wide TeamId is only the fallback for a
            // single-team setup where per-agent teams were not supplied.
            return new LeadOwner(a.UserId, a.UserName, a.TeamId ?? cmd.TeamId);

        // Agent has left Property Finder, or was never mapped.
        return cmd.FallbackUserId is { } fb
            ? new LeadOwner(fb, cmd.FallbackUserName ?? "", cmd.TeamId)
            : null;
    }

    /// <summary>
    /// What decides "is this the same lead?" — the person AND the agent they contacted.
    ///
    /// <para>Phone identifies the person: it is on every enquiry in the connected account, while
    /// email is on under 2%, so keying on email would make almost every enquiry a separate person.</para>
    ///
    /// <para>The agent is part of the key because one buyer commonly contacts several agents — 433
    /// people in this account did. Keying on the phone alone gave the lead to whichever agent was
    /// most recent and left the others with nothing, despite Property Finder having assigned each of
    /// them an enquiry. Repeat contact with the SAME agent still merges onto that agent's lead.</para>
    /// </summary>
    private static string? IdentityKey(JsonElement lead)
    {
        var agent = PropertyFinderLeadMapper.ProfileId(lead)?.ToString() ?? "none";
        if (!lead.TryGetProperty("sender", out var s) || s.ValueKind != JsonValueKind.Object) return null;
        if (!s.TryGetProperty("contacts", out var cs) || cs.ValueKind != JsonValueKind.Array) return null;

        string? phone = null, email = null;
        foreach (var c in cs.EnumerateArray())
        {
            var val = Str(c, "value");
            if (val is null) continue;
            switch (Str(c, "type"))
            {
                case "phone": phone ??= val; break;
                case "email": email ??= val; break;
            }
        }
        if (phone is not null) return $"p:{NormalizePhone(phone)}|{agent}";
        if (email is not null) return $"e:{email.Trim().ToLowerInvariant()}|{agent}";
        return Str(lead, "id") is { } id ? "x:" + id : null;
    }

    /// <summary>
    /// Property Finder returns numbers as "+971 55 913 7418". Comparing those literally would treat
    /// the same number formatted two ways as two people, so everything but the digits is dropped
    /// and only the last 9 digits are compared — enough to be unique in practice while surviving
    /// a missing or differing country prefix.
    /// </summary>
    private static string NormalizePhone(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        return digits.Length > 9 ? digits[^9..] : digits;
    }

    private static string Created(JsonElement e) => Str(e, "createdAt") ?? "";

    private static string? Str(JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString()!.Trim(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";

    /// <summary>Trim to what the column can hold — see the note at the call site.</summary>
    private static string? Clip(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var v = s.Trim();
        return v.Length <= max ? v : v[..max];
    }

    private sealed class Counters
    {
        public int People, Created, Duplicates, Failed, Enquiries, Unassigned;
    }
}
