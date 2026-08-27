using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.AiEvents;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Application.LeadIntake.Notifications;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations;

/// <summary>
/// The single intake funnel. Tenant-explicit (safe from anonymous webhook contexts):
/// it filters and stamps by <paramref name="tenantId"/> rather than relying on the ambient
/// tenant, because webhooks arrive unauthenticated.
/// </summary>
public sealed class LeadIntakeService(
    CrmDbContext db,
    IMediator mediator,
    IAiEventBus aiEvents,
    ILogger<LeadIntakeService> logger) : ILeadIntakeService
{
    public async Task<IntakeResult> IngestAsync(CanonicalLead lead, Guid tenantId, Integration? integration, CancellationToken ct, LeadOwner? owner = null)
    {
        ApplyFieldMappings(lead, integration);
        NormalizeNames(lead);

        var email = Clean(lead.Email)?.ToLowerInvariant();
        var phone = Clean(lead.Phone);
        var first = Clean(lead.FirstName);
        var last  = Clean(lead.LastName);

        if (email is null && phone is null && first is null && last is null)
            return IntakeResult.Rejected("Lead has no email, phone, or name — nothing to create.");

        // Resolved first, because when the source knows whose lead it is, the owner is part of
        // what makes two records "the same".
        owner ??= ResolveExternalOwner(lead, integration);

        // ── Duplicate detection (configurable) ────────────────────────────────
        var dedupe = ParseDedupe(integration?.DedupeConfig);
        var match = await FindDuplicateAsync(
            tenantId, email, phone, lead.ExternalLeadId, integration?.ProviderKey, owner?.UserId, dedupe, ct);

        // Two very different situations used to share one answer, "duplicate — skipped":
        //
        //  • the SAME source record arriving twice (webhook retries are at-least-once) — a true
        //    no-op, and the only case that should be silently dropped;
        //  • the same PERSON getting in touch again — real, new work. Skipping those was losing a
        //    quarter of everything a property portal sends, usually on the same day, while a buyer
        //    messaged several agents at once. The second and third agent were never told.
        if (match is { } m)
        {
            if (m.MatchedOnExternalId)
            {
                logger.LogInformation("Intake: already received {External} for tenant {Tenant}.",
                    lead.ExternalLeadId, tenantId);
                return IntakeResult.Duplicate(m.LeadId);
            }

            return await EnrichExistingAsync(m.LeadId, lead, tenantId, integration, owner, source: null, ct);
        }

        // ── Routing / assignment ──────────────────────────────────────────────
        // Precedence: an owner the caller resolved (the import knows exactly who) → the source
        // system's own owner (resolved above) → routing config, which can only ever name someone
        // and leaves AssignedToUserId/TeamId null.
        var assignedTo = owner?.UserName ?? ResolveAssignee(integration);

        var source = !string.IsNullOrWhiteSpace(integration?.ProviderKey) ? integration!.ProviderKey
                   : !string.IsNullOrWhiteSpace(lead.UtmSource) ? lead.UtmSource!
                   : "integration";

        var newLead = new Lead(
            firstName:      Clip(first, 100) ?? "",
            lastName:       Clip(last, 100) ?? "",
            title:          Clip(lead.Title, 100) ?? "",
            company:        Clip(lead.Company, 200) ?? "",
            industry:       Clip(lead.Industry, 100) ?? "",
            email:          Clip(email, 200) ?? "",
            phone:          Clip(phone, 50) ?? "",
            country:        Clip(lead.Country, 100) ?? "",
            city:           Clip(lead.City, 100) ?? "",
            source:         source,
            priority:       "medium",
            estimatedValue: 0m,
            assignedTo:     Clip(assignedTo, 200) ?? "",
            notes:          Clip(lead.Notes, 2000));

        // Requirements captured from the lead-gen form (or promoted via field mappings).
        newLead.SetRequirements(Clip(lead.WhatsApp, 50), Clip(lead.InterestedIn, 500), Clip(lead.Budget, 100),
            Clip(lead.Message, 4000), Clip(lead.Timeframe, 100));

        // Marketing / attribution — denormalized onto the lead for the drawer's Marketing panel.
        var platform = Clean(lead.Platform)
                    ?? (string.Equals(source, "integration", StringComparison.OrdinalIgnoreCase) ? null : Clean(source));
        newLead.SetMarketing(
            platform:            platform,
            formName:            Clean(lead.FormName),
            isOrganic:           lead.IsOrganic,
            campaign:            Clean(lead.Campaign) ?? Clean(lead.UtmCampaign),
            adName:              Clean(lead.AdName),
            adSetName:           Clean(lead.AdSetName),
            platformCreatedTime: Clean(lead.PlatformCreatedTime),
            customFields:        BuildCustomFields(lead.RawFields));

        // Derive a pipeline value from the free-text budget (inbound leads carry no numeric value),
        // detect an urgency tag from the message when no explicit timeframe came through, then run
        // automatic rule-based scoring from the captured signals (no activity yet → 0).
        newLead.DeriveEstimatedValueFromBudget();
        newLead.DetectTimeframeFromText();
        newLead.RecalculateScore(0);

        // Stamp tenant explicitly — webhook requests are anonymous, so the ambient tenant
        // is unresolved and SaveChanges' auto-stamp is a no-op.
        // Owner AND team together. A lead filed to a user but to no team is invisible to that
        // user's team lead (Module 31) — precisely what an import must not silently produce.
        if (owner is not null) newLead.AssignTo(owner.UserId, owner.UserName, owner.TeamId);

        StampTenant(newLead, tenantId);
        db.Leads.Add(newLead);

        var provenance = new LeadSource(newLead.Id, integration?.Id, source, lead.ExternalLeadId);
        provenance.SetAttribution(lead.Campaign, lead.CampaignId, lead.AdSetId, lead.AdId, lead.PageId, lead.FormId);
        provenance.SetUtm(lead.UtmSource, lead.UtmMedium, lead.UtmCampaign, lead.UtmTerm, lead.UtmContent);
        provenance.SetRaw(lead.RawJson);
        StampTenant(provenance, tenantId);
        db.LeadSources.Add(provenance);

        await db.SaveChangesAsync(ct);

        // Automations subscribe to this (task / email / outbound webhook / workflow).
        await mediator.Publish(new LeadIngestedNotification(
            tenantId, newLead.Id, integration?.Id, source, newLead.FullName, email, phone, assignedTo), ct);

        // Fire the AI event too (best-effort, never throws). Tenant-explicit overload: webhook
        // requests are anonymous, so the ambient-tenant overload would silently skip the event —
        // event-triggered AI automations and the voice agent must also fire for integration leads.
        await aiEvents.PublishAsync(new AiTriggerEvent(
            AiEventKeys.CrmLeadCreated, newLead.Id, $"New lead: {newLead.FullName}",
            JsonSerializer.Serialize(new
            {
                newLead.Id, newLead.FirstName, newLead.LastName, newLead.Company,
                newLead.Email, newLead.Phone, newLead.Country, newLead.City, newLead.Source,
            })), tenantId, ct);

        logger.LogInformation("Intake: created lead {Lead} for tenant {Tenant} via {Source}.", newLead.Id, tenantId, source);
        return IntakeResult.Created(newLead.Id);
    }

    // ── Field mapping ─────────────────────────────────────────────────────────

    private static void ApplyFieldMappings(CanonicalLead lead, Integration? integration)
    {
        if (integration?.FieldMappings is not { Count: > 0 } mappings) return;

        foreach (var m in mappings)
        {
            if (!lead.RawFields.TryGetValue(m.SourceField, out var value) || string.IsNullOrWhiteSpace(value))
                continue;

            switch (m.TargetField)
            {
                case CanonicalLeadFields.FirstName: lead.FirstName ??= value; break;
                case CanonicalLeadFields.LastName:  lead.LastName  ??= value; break;
                case CanonicalLeadFields.FullName:  lead.FullName  ??= value; break;
                case CanonicalLeadFields.Email:     lead.Email     ??= value; break;
                case CanonicalLeadFields.Phone:     lead.Phone     ??= value; break;
                case CanonicalLeadFields.Company:   lead.Company   ??= value; break;
                case CanonicalLeadFields.Title:     lead.Title     ??= value; break;
                case CanonicalLeadFields.Industry:  lead.Industry  ??= value; break;
                case CanonicalLeadFields.Address:   lead.Address   ??= value; break;
                case CanonicalLeadFields.City:      lead.City      ??= value; break;
                case CanonicalLeadFields.Country:   lead.Country   ??= value; break;
                case CanonicalLeadFields.Notes:     lead.Notes     ??= value; break;
                case CanonicalLeadFields.WhatsApp:     lead.WhatsApp     ??= value; break;
                case CanonicalLeadFields.InterestedIn: lead.InterestedIn ??= value; break;
                case CanonicalLeadFields.Budget:       lead.Budget       ??= value; break;
                case CanonicalLeadFields.Message:      lead.Message      ??= value; break;
                case CanonicalLeadFields.Timeframe:    lead.Timeframe    ??= value; break;
                case CanonicalLeadFields.Campaign:     lead.Campaign     ??= value; break;
                case CanonicalLeadFields.FormName:     lead.FormName     ??= value; break;
            }
        }
    }

    private static void NormalizeNames(CanonicalLead lead)
    {
        if (!string.IsNullOrWhiteSpace(lead.FirstName)) return;
        var full = Clean(lead.FullName);
        if (full is null) return;

        var parts = full.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        lead.FirstName = parts.Length > 0 ? parts[0] : full;
        if (parts.Length > 1) lead.LastName ??= parts[1];
    }

    // ── Duplicate detection ───────────────────────────────────────────────────

    /// <summary>An existing lead this payload belongs to, and what identified it.</summary>
    private readonly record struct DuplicateMatch(Guid LeadId, bool MatchedOnExternalId);

    /// <param name="ownerUserId">
    /// When the source system says who owns this lead, two records only count as the same lead if
    /// they belong to the SAME owner.
    ///
    /// <para>On a property portal one buyer commonly contacts several agents — 433 people in the
    /// connected account did, some as many as ten. Merging on the phone number alone gave the lead
    /// to whichever agent happened to be most recent and left the others with nothing, even though
    /// the portal had assigned each of them an enquiry of their own. Each agent now gets their own
    /// lead; repeat contact with the SAME agent still merges onto theirs.</para>
    ///
    /// <para>Null for sources that do not know an owner (web forms, ad platforms), which keeps the
    /// plain one-lead-per-person behaviour for them.</para>
    /// </param>
    private async Task<DuplicateMatch?> FindDuplicateAsync(
        Guid tenantId, string? email, string? phone, string? externalId, string? providerKey,
        Guid? ownerUserId, DedupeRules rules, CancellationToken ct)
    {
        if (rules.ByExternalId && !string.IsNullOrWhiteSpace(externalId) && !string.IsNullOrWhiteSpace(providerKey))
        {
            var src = await db.LeadSources.AsNoTracking()
                .Where(x => EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId
                         && x.ProviderKey == providerKey && x.ExternalLeadId == externalId)
                .Select(x => (Guid?)x.LeadId)
                .FirstOrDefaultAsync(ct);
            // The same source record, seen before — provenance rows are written per enquiry, so
            // this is what makes an at-least-once webhook redelivery a genuine no-op.
            if (src is not null) return new DuplicateMatch(src.Value, MatchedOnExternalId: true);
        }

        var leads = db.Leads.AsNoTracking()
            .Where(x => !x.IsDeleted && EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId);

        // An unowned lead is still a match: the first agent to be given this person should take it
        // over rather than have a second copy created alongside it.
        if (ownerUserId is { } oid)
            leads = leads.Where(x => x.AssignedToUserId == oid || x.AssignedToUserId == null);

        if (rules.ByEmail && !string.IsNullOrWhiteSpace(email))
        {
            var byEmail = await leads.Where(x => x.Email == email).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
            if (byEmail is not null) return new DuplicateMatch(byEmail.Value, MatchedOnExternalId: false);
        }

        if (rules.ByPhone && !string.IsNullOrWhiteSpace(phone))
        {
            var byPhone = await leads.Where(x => x.Phone == phone).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
            if (byPhone is not null) return new DuplicateMatch(byPhone.Value, MatchedOnExternalId: false);
        }

        return null;
    }

    // ── Repeat contact ────────────────────────────────────────────────────────

    /// <summary>
    /// Someone already in the CRM has been in touch again. The existing lead is enriched rather
    /// than duplicated: the contact goes on its timeline, newer details fill in, the score is
    /// recomputed, and the owner is notified — so a returning buyer surfaces instead of vanishing.
    /// </summary>
    private async Task<IntakeResult> EnrichExistingAsync(
        Guid leadId, CanonicalLead lead, Guid tenantId, Integration? integration,
        LeadOwner? owner, string? source, CancellationToken ct)
    {
        var existing = await db.Leads.FirstOrDefaultAsync(
            x => x.Id == leadId && EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId, ct);
        if (existing is null) return IntakeResult.Duplicate(leadId);

        source ??= !string.IsNullOrWhiteSpace(integration?.ProviderKey) ? integration!.ProviderKey : "integration";

        // Ownership only moves when the source says so. A repeat enquiry must NOT quietly transfer
        // a lead to whichever agent happened to receive the latest message — the first agent owns
        // the relationship. An unowned lead is the exception: someone is better than nobody.
        owner ??= ResolveExternalOwner(lead, integration);
        if (owner is not null && (lead.IsReassignment || existing.AssignedToUserId is null))
            existing.AssignTo(owner.UserId, owner.UserName, owner.TeamId);

        // Newer details win where they exist, but never blank out what is already known — the
        // timeline keeps the previous values, so nothing is actually lost.
        existing.SetRequirements(
            Clip(lead.WhatsApp, 50)      ?? existing.WhatsApp,
            Clip(lead.InterestedIn, 500) ?? existing.InterestedIn,
            Clip(lead.Budget, 100)       ?? existing.Budget,
            Clip(lead.Message, 4000)     ?? existing.Message,
            Clip(lead.Timeframe, 100)    ?? existing.PurchaseTimeframe);

        var activity = new Activity(
            type:          "note",
            subject:       Clip(RepeatSubject(lead, source), 300) ?? "Enquiry",
            description:   Clip(lead.Notes, 2000) ?? Clip(lead.Message, 2000),
            relatedToType: "lead",
            relatedToId:   existing.Id,
            relatedToName: existing.FullName,
            dueDate:       null,
            assignedTo:    existing.AssignedTo);
        StampTenant(activity, tenantId);
        db.Activities.Add(activity);

        // Provenance per enquiry, not per lead: without a row for THIS record, a webhook redelivery
        // would look like yet another repeat and log the same contact twice.
        var provenance = new LeadSource(existing.Id, integration?.Id, source, lead.ExternalLeadId);
        provenance.SetRaw(lead.RawJson);
        StampTenant(provenance, tenantId);
        db.LeadSources.Add(provenance);

        // Getting in touch again is the strongest intent signal there is, so it must move the score.
        var activityCount = await db.Activities.CountAsync(
            a => a.RelatedToType == "lead" && a.RelatedToId == existing.Id && !a.IsDeleted, ct);
        existing.DeriveEstimatedValueFromBudget();
        existing.DetectTimeframeFromText();
        existing.RecalculateScore(activityCount + 1);

        await db.SaveChangesAsync(ct);

        // Same notification as a new lead: to the owner this IS new work, and automations that act
        // on an incoming enquiry should fire for a returning buyer too.
        await mediator.Publish(new LeadIngestedNotification(
            tenantId, existing.Id, integration?.Id, source, existing.FullName,
            existing.Email, existing.Phone, existing.AssignedTo), ct);

        logger.LogInformation(
            "Intake: repeat contact recorded on lead {Lead} for tenant {Tenant} via {Source}.",
            existing.Id, tenantId, source);

        return IntakeResult.Updated(existing.Id);
    }

    private static string RepeatSubject(CanonicalLead lead, string source)
    {
        if (lead.IsReassignment) return "Reassigned by " + Humanise(source);
        var what = Clean(lead.InterestedIn);
        var head = Humanise(source) + " enquiry";
        return what is null ? head : $"{head} — {(what.Length > 90 ? what[..90] + "…" : what)}";
    }

    private static string Humanise(string s) =>
        string.IsNullOrWhiteSpace(s) ? "New" :
        char.ToUpperInvariant(s[0]) + s[1..].Replace('-', ' ').Replace('_', ' ');

    // ── Routing ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves the lead to a real Vrodux user using the source system's own owner id.
    ///
    /// <para>Routing config can only name someone, which leaves <c>AssignedToUserId</c> and
    /// <c>TeamId</c> null — and since Module 31 a record with no team is invisible to team leads.
    /// When the source already knows whose lead it is (a portal assigns each enquiry to an agent),
    /// honouring that beats round-robining it to whoever is next.</para>
    /// </summary>
    private static LeadOwner? ResolveExternalOwner(CanonicalLead lead, Integration? integration)
    {
        if (string.IsNullOrWhiteSpace(lead.ExternalOwnerId)) return null;

        var routing = ParseRouting(integration?.RoutingConfig);
        if (routing.ExternalMap is not { Count: > 0 } map) return null;
        if (!map.TryGetValue(lead.ExternalOwnerId, out var entry)) return null;
        if (!Guid.TryParse(entry.UserId, out var userId)) return null;

        Guid? teamId = Guid.TryParse(entry.TeamId, out var t) ? t : null;
        return new LeadOwner(userId, entry.UserName ?? "", teamId);
    }


    private static string ResolveAssignee(Integration? integration)
    {
        var routing = ParseRouting(integration?.RoutingConfig);
        return routing.Mode switch
        {
            "unassigned"  => "",
            "round_robin" when routing.Pool is { Length: > 0 } && integration is not null
                          => routing.Pool[integration.NextRoutingCursor(routing.Pool.Length)],
            _             => routing.AssignTo ?? "",
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void StampTenant(object entity, Guid tenantId) =>
        db.Entry(entity).Property(TenantIsolation.Column).CurrentValue = tenantId;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>
    /// Trim to what the column can hold.
    ///
    /// <para>Every value here comes from someone else's system, so its length is not ours to
    /// assume. A property portal listing title, an enquiry note or a call-recording URL can each
    /// be far longer than the field it lands in, and SQL Server answers that with "String or
    /// binary data would be truncated" — which fails the whole save, not just the long field. One
    /// oversized title would abandon an entire import batch.</para>
    ///
    /// <para>The limits mirror <c>CrmConfigurations</c>. They are stated at the call site rather
    /// than centralised so that changing a column and forgetting this is a visible mismatch.</para>
    /// </summary>
    private static string? Clip(string? s, int max)
    {
        var v = Clean(s);
        return v is null || v.Length <= max ? v : v[..max];
    }

    /// <summary>
    /// Raw source fields that were NOT promoted to a standard lead field become the lead's
    /// "Form Responses" (survey Q&amp;A / custom questions). Known contact/attribution keys are
    /// filtered out so the catch-all doesn't just repeat name/email/phone.
    /// </summary>
    private static Dictionary<string, string>? BuildCustomFields(IReadOnlyDictionary<string, string?> raw)
    {
        if (raw.Count == 0) return null;
        var extra = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (k, v) in raw)
        {
            if (string.IsNullOrWhiteSpace(k) || string.IsNullOrWhiteSpace(v)) continue;
            if (KnownRawKeys.Contains(Normalize(k))) continue;
            extra[k] = v.Trim();
        }
        return extra.Count > 0 ? extra : null;
    }

    private static string Normalize(string s)
    {
        Span<char> buf = stackalloc char[s.Length];
        var n = 0;
        foreach (var c in s)
            if (char.IsLetterOrDigit(c)) buf[n++] = char.ToLowerInvariant(c);
        return new string(buf[..n]);
    }

    private static readonly HashSet<string> KnownRawKeys = new(StringComparer.Ordinal)
    {
        "firstname", "lastname", "fullname", "name", "email", "emailaddress", "phone", "phonenumber",
        "mobile", "company", "companyname", "jobtitle", "title", "industry", "address", "streetaddress",
        "city", "country", "notes", "whatsapp", "whatsappnumber", "interestedin", "budget", "message",
        "timeframe", "timeline", "whentobuy", "whenlookingtobuy", "purchasetimeline", "buyingtimeline",
        "whenplanningtoinvest", "movein", "urgency",
        "campaign", "campaignname", "formname", "form",
    };

    private static DedupeRules ParseDedupe(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new DedupeRules(true, true, true);
        try { return JsonSerializer.Deserialize<DedupeRules>(json, JsonOpts) ?? new(true, true, true); }
        catch { return new DedupeRules(true, true, true); }
    }

    private static RoutingRules ParseRouting(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new RoutingRules("fixed", null, null);
        try { return JsonSerializer.Deserialize<RoutingRules>(json, JsonOpts) ?? new("fixed", null, null); }
        catch { return new RoutingRules("fixed", null, null); }
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private sealed record DedupeRules(bool ByEmail, bool ByPhone, bool ByExternalId);
    private sealed record RoutingRules(
        string Mode, string? AssignTo, string[]? Pool,
        /// <summary>Source-system owner id → the Vrodux user who should own their leads.</summary>
        Dictionary<string, ExternalOwnerEntry>? ExternalMap = null);

    private sealed record ExternalOwnerEntry(string? UserId, string? UserName, string? TeamId);
}
