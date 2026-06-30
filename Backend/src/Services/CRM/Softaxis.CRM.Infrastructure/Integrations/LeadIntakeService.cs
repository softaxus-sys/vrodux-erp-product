using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    ILogger<LeadIntakeService> logger) : ILeadIntakeService
{
    public async Task<IntakeResult> IngestAsync(CanonicalLead lead, Guid tenantId, Integration? integration, CancellationToken ct)
    {
        ApplyFieldMappings(lead, integration);
        NormalizeNames(lead);

        var email = Clean(lead.Email)?.ToLowerInvariant();
        var phone = Clean(lead.Phone);
        var first = Clean(lead.FirstName);
        var last  = Clean(lead.LastName);

        if (email is null && phone is null && first is null && last is null)
            return IntakeResult.Rejected("Lead has no email, phone, or name — nothing to create.");

        // ── Duplicate detection (configurable) ────────────────────────────────
        var dedupe = ParseDedupe(integration?.DedupeConfig);
        var existingId = await FindDuplicateAsync(tenantId, email, phone, lead.ExternalLeadId, integration?.ProviderKey, dedupe, ct);
        if (existingId is not null)
        {
            logger.LogInformation("Intake: duplicate lead for tenant {Tenant} (existing {Lead}).", tenantId, existingId);
            return IntakeResult.Duplicate(existingId);
        }

        // ── Routing / assignment ──────────────────────────────────────────────
        var assignedTo = ResolveAssignee(integration);

        var source = !string.IsNullOrWhiteSpace(integration?.ProviderKey) ? integration!.ProviderKey
                   : !string.IsNullOrWhiteSpace(lead.UtmSource) ? lead.UtmSource!
                   : "integration";

        var newLead = new Lead(
            firstName:      first ?? "",
            lastName:       last ?? "",
            title:          Clean(lead.Title) ?? "",
            company:        Clean(lead.Company) ?? "",
            industry:       Clean(lead.Industry) ?? "",
            email:          email ?? "",
            phone:          phone ?? "",
            country:        Clean(lead.Country) ?? "",
            city:           Clean(lead.City) ?? "",
            source:         source,
            priority:       "medium",
            estimatedValue: 0m,
            assignedTo:     assignedTo,
            notes:          Clean(lead.Notes));

        // Stamp tenant explicitly — webhook requests are anonymous, so the ambient tenant
        // is unresolved and SaveChanges' auto-stamp is a no-op.
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

    private async Task<Guid?> FindDuplicateAsync(
        Guid tenantId, string? email, string? phone, string? externalId, string? providerKey,
        DedupeRules rules, CancellationToken ct)
    {
        if (rules.ByExternalId && !string.IsNullOrWhiteSpace(externalId) && !string.IsNullOrWhiteSpace(providerKey))
        {
            var src = await db.LeadSources.AsNoTracking()
                .Where(x => EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId
                         && x.ProviderKey == providerKey && x.ExternalLeadId == externalId)
                .Select(x => (Guid?)x.LeadId)
                .FirstOrDefaultAsync(ct);
            if (src is not null) return src;
        }

        var leads = db.Leads.AsNoTracking()
            .Where(x => !x.IsDeleted && EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId);

        if (rules.ByEmail && !string.IsNullOrWhiteSpace(email))
        {
            var byEmail = await leads.Where(x => x.Email == email).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
            if (byEmail is not null) return byEmail;
        }

        if (rules.ByPhone && !string.IsNullOrWhiteSpace(phone))
        {
            var byPhone = await leads.Where(x => x.Phone == phone).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
            if (byPhone is not null) return byPhone;
        }

        return null;
    }

    // ── Routing ───────────────────────────────────────────────────────────────

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
    private sealed record RoutingRules(string Mode, string? AssignTo, string[]? Pool);
}
