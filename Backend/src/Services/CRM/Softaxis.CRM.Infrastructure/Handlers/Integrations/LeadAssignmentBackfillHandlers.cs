using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Shared by the preview and the apply so the two cannot disagree about which leads are in scope
/// or who they resolve to. A preview that showed something other than what apply did would be
/// worse than no preview at all.
/// </summary>
internal static class LeadAssignmentBackfill
{
    /// <summary>
    /// Bounded on purpose. A portal account can hold tens of thousands of historical leads, and
    /// resolving each one reads the routing map and possibly the portal user directory. Nobody is
    /// reviewing 40,000 rows before approving them either.
    /// </summary>
    public const int MaxLeads = 1000;

    public static async Task<Integration?> FindIntegrationAsync(CrmDbContext db, Guid id, CancellationToken ct) =>
        await db.Integrations.FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted, ct);

    /// <summary>
    /// The leads this integration produced. Matched on <c>Lead.Source</c>, which intake stamps with
    /// the provider key. The inbox rows that created them are not a reliable route back, since they
    /// are pruned over time while the leads remain.
    /// </summary>
    public static async Task<List<Lead>> LoadLeadsAsync(
        CrmDbContext db, Integration integration, bool includeAssigned, CancellationToken ct)
    {
        var key = integration.ProviderKey;
        var q = db.Leads.Where(l => !l.IsDeleted && l.Source == key);

        // An owned lead has usually been worked; re-pointing it takes it off whoever is on it.
        if (!includeAssigned) q = q.Where(l => l.AssignedToUserId == null);

        return await q.OrderByDescending(l => l.CreatedAt).Take(MaxLeads).ToListAsync(ct);
    }

    /// <summary>
    /// Rebuilds just enough of the original payload identity for the live resolver to work on. The
    /// values come from the lead own stored fields: the listing and agent details the mapper
    /// promoted into Form Responses when the enquiry first arrived.
    /// </summary>
    public static CanonicalLead ToResolverInput(Lead lead)
    {
        string? Field(string k) =>
            lead.CustomFields is { } c
            && c.FirstOrDefault(e => string.Equals(e.Key, k, StringComparison.OrdinalIgnoreCase))
                is { Value: { Length: > 0 } v }
                ? v.Trim() : null;

        return new CanonicalLead
        {
            // Property Finder writes the agent profile id here; a Bayut push names no agent at all,
            // which is exactly the case the listing keys below exist to cover.
            ExternalOwnerId    = Field("pf_agent_profile_id") ?? Field("agent_email"),
            ExternalOwnerEmail = Field("agent_email"),
            ExternalOwnerPhone = Field("agent_phone"),
            // "agent" is what the Bayut mapper wrote before it had a dedicated agent_name key,
            // so historical rows are read too rather than looking agent-less.
            ExternalOwnerName  = Field("agent_name") ?? Field("listing_agent") ?? Field("agent"),
            ListingReference   = Field("listing_reference"),
            ListingId          = Field("listing_id"),
        };
    }

    /// <summary>Why nothing resolved, rather than leaving a blank row unexplained.</summary>
    public static string WhyNot(CanonicalLead input) =>
        input.ExternalOwnerId is null && input.ExternalOwnerEmail is null && input.ExternalOwnerPhone is null
        && input.ListingReference is null && input.ListingId is null
            ? "This lead records no agent and no listing, so there is nothing to match on."
            : "No user in this workspace matches the portal agent for this listing.";
}

internal sealed class PreviewLeadAssignmentBackfillHandler(
    CrmDbContext db,
    IPortalOwnerResolver resolver)
    : IQueryHandler<PreviewLeadAssignmentBackfillQuery, LeadAssignmentBackfillPreviewDto>
{
    public async Task<Result<LeadAssignmentBackfillPreviewDto>> Handle(
        PreviewLeadAssignmentBackfillQuery query, CancellationToken ct)
    {
        var integration = await LeadAssignmentBackfill.FindIntegrationAsync(db, query.IntegrationId, ct);
        if (integration is null)
            return Result.Failure<LeadAssignmentBackfillPreviewDto>(
                Error.NotFoundById("Integration", query.IntegrationId));

        var tenantId = TenantAmbient.TenantId;
        if (tenantId is null)
            return Result.Failure<LeadAssignmentBackfillPreviewDto>(
                Error.Custom("Integration.NoTenant", "No workspace could be resolved for this request."));

        var leads = await LeadAssignmentBackfill.LoadLeadsAsync(db, integration, query.IncludeAssigned, ct);

        var candidates = new List<LeadAssignmentCandidateDto>(leads.Count);
        int resolvable = 0, owned = 0;

        foreach (var lead in leads)
        {
            var input = LeadAssignmentBackfill.ToResolverInput(lead);
            var owner = await resolver.ResolveAsync(input, integration, tenantId.Value, ct);
            if (owner is not null) resolvable++;
            if (lead.AssignedToUserId is not null) owned++;

            var name = $"{lead.FirstName} {lead.LastName}".Trim();
            candidates.Add(new LeadAssignmentCandidateDto(
                lead.Id,
                name.Length > 0 ? name : "(no name)",
                string.IsNullOrWhiteSpace(lead.Phone) ? null : lead.Phone,
                lead.CreatedAt,
                input.ListingReference ?? input.ListingId,
                input.ExternalOwnerName,
                string.IsNullOrWhiteSpace(lead.AssignedTo) ? null : lead.AssignedTo,
                owner?.UserId, owner?.UserName, owner?.TeamId,
                owner is null ? LeadAssignmentBackfill.WhyNot(input) : null));
        }

        // Resolution can WRITE to the integration: a portal-directory match is remembered on the
        // routing config. Saving that here is deliberate. It is a record of who the portal agents
        // are, so applying afterwards does not repeat the same lookups.
        await db.SaveChangesAsync(ct);

        return Result.Success(new LeadAssignmentBackfillPreviewDto(
            Total:        candidates.Count,
            Resolvable:   resolvable,
            AlreadyOwned: owned,
            Unresolvable: candidates.Count - resolvable,
            Candidates:   candidates));
    }
}

internal sealed class ApplyLeadAssignmentBackfillHandler(
    CrmDbContext db,
    IPortalOwnerResolver resolver,
    ILogger<ApplyLeadAssignmentBackfillHandler> logger)
    : ICommandHandler<ApplyLeadAssignmentBackfillCommand, LeadAssignmentBackfillResultDto>
{
    public async Task<Result<LeadAssignmentBackfillResultDto>> Handle(
        ApplyLeadAssignmentBackfillCommand cmd, CancellationToken ct)
    {
        var integration = await LeadAssignmentBackfill.FindIntegrationAsync(db, cmd.IntegrationId, ct);
        if (integration is null)
            return Result.Failure<LeadAssignmentBackfillResultDto>(
                Error.NotFoundById("Integration", cmd.IntegrationId));

        var tenantId = TenantAmbient.TenantId;
        if (tenantId is null)
            return Result.Failure<LeadAssignmentBackfillResultDto>(
                Error.Custom("Integration.NoTenant", "No workspace could be resolved for this request."));

        if (cmd.LeadIds.Count == 0)
            return Result.Success(new LeadAssignmentBackfillResultDto(0, 0));

        if (cmd.LeadIds.Count > LeadAssignmentBackfill.MaxLeads)
            return Result.Failure<LeadAssignmentBackfillResultDto>(Error.Custom(
                "Integration.Conflict",
                $"Assign at most {LeadAssignmentBackfill.MaxLeads} leads at a time."));

        var ids = cmd.LeadIds.Distinct().ToList();
        // Source is re-checked rather than trusted from the request, so an id from elsewhere cannot
        // become a way to reassign an unrelated lead through this endpoint.
        var leads = await db.Leads
            .Where(l => !l.IsDeleted && l.Source == integration.ProviderKey && ids.Contains(l.Id))
            .ToListAsync(ct);

        var assigned = 0;
        foreach (var lead in leads)
        {
            var owner = await resolver.ResolveAsync(
                LeadAssignmentBackfill.ToResolverInput(lead), integration, tenantId.Value, ct);
            if (owner is null) continue;

            // Owner AND team together: a lead filed to no team is invisible to team leads, so
            // setting one without the other moves it out of sight rather than into place.
            lead.AssignTo(owner.UserId, owner.UserName, owner.TeamId);
            assigned++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Assignment backfill: {Assigned} of {Requested} {Provider} lead(s) assigned for tenant {Tenant}.",
            assigned, ids.Count, integration.ProviderKey, tenantId);

        return Result.Success(new LeadAssignmentBackfillResultDto(assigned, ids.Count - assigned));
    }
}
