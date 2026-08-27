using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.PropertyFinderImport.Dtos;
using Softaxis.CRM.Application.PropertyFinderImport.Queries;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.PropertyFinderImport;

/// <summary>
/// Builds the read-only picture of a Property Finder import: which agents exist, how many leads
/// each owns, which of their emails are already taken, and what a phone-based dedupe would produce.
/// Writes nothing — this exists so the mapping is reviewed before any login or lead is created.
/// </summary>
internal sealed class GetPropertyFinderPreviewHandler(
    PropertyFinderApiClient api,
    PropertyFinderCredentialStore credentials,
    CrmDbContext db)
    : IQueryHandler<GetPropertyFinderPreviewQuery, PfImportPreviewDto>
{
    public async Task<Result<PfImportPreviewDto>> Handle(GetPropertyFinderPreviewQuery query, CancellationToken ct)
    {
        // This tenant's own key — never a shared one. See PropertyFinderCredentialStore.
        var cred = await credentials.ResolveAsync(ct);
        if (cred is null)
            return Result.Failure<PfImportPreviewDto>(Error.Custom(
                "PropertyFinder.NotConfigured",
                "Property Finder is not connected for this workspace. Connect it under Settings → Integrations and enter this agency's own API key and secret."));

        List<JsonElement> roles, users;
        List<JsonElement> leads = [];
        try
        {
            roles = (await api.GetRolesAsync(cred, ct)).ToList();

            users = [];
            for (var page = 1; ; page++)
            {
                var p = await api.GetUsersPageAsync(cred, page, ct);
                users.AddRange(p.Items);
                if (page >= p.TotalPages || p.Items.Count == 0) break;
            }

            // No date filter: the 3-month rule limits the createdAtFrom VALUE, not the dataset, so
            // unfiltered paging is what reaches the full history.
            for (var page = 1; ; page++)
            {
                var p = await api.GetLeadsPageAsync(cred, page, null, ct);
                leads.AddRange(p.Items);
                if (page >= p.TotalPages || p.Items.Count == 0) break;
            }
        }
        catch (PropertyFinderScopeException ex)
        {
            return Result.Failure<PfImportPreviewDto>(Error.Custom("PropertyFinder.Forbidden", ex.Message));
        }
        catch (PropertyFinderAuthException ex)
        {
            return Result.Failure<PfImportPreviewDto>(Error.Custom("PropertyFinder.Unauthorized", ex.Message));
        }
        catch (PropertyFinderApiException ex)
        {
            return Result.Failure<PfImportPreviewDto>(Error.Custom("PropertyFinder.Failed", ex.Message));
        }

        // ── Lead statistics, keyed by the agent's public-profile id ─────────────
        var leadsByProfile = new Dictionary<int, int>();
        var phones = new List<string>();
        string? oldest = null, newest = null;
        foreach (var l in leads)
        {
            if (PropertyFinderLeadMapper.ProfileId(l) is { } pid)
                leadsByProfile[pid] = leadsByProfile.GetValueOrDefault(pid) + 1;

            if (l.TryGetProperty("sender", out var s) && s.ValueKind == JsonValueKind.Object &&
                s.TryGetProperty("contacts", out var cs) && cs.ValueKind == JsonValueKind.Array)
                foreach (var c in cs.EnumerateArray())
                    if (c.TryGetProperty("type", out var t) && t.GetString() == "phone" &&
                        c.TryGetProperty("value", out var v) && v.GetString() is { Length: > 0 } phone)
                    { phones.Add(phone); break; }

            if (l.TryGetProperty("createdAt", out var ca) && ca.GetString() is { } created)
            {
                if (oldest is null || string.CompareOrdinal(created, oldest) < 0) oldest = created;
                if (newest is null || string.CompareOrdinal(created, newest) > 0) newest = created;
            }
        }

        // ── Which emails are already logins? ────────────────────────────────────
        var pfEmails = users
            .Select(u => u.TryGetProperty("email", out var e) ? e.GetString() : null)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e!.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

        var taken = new Dictionary<string, Guid?>(StringComparer.OrdinalIgnoreCase);
        if (pfEmails.Count > 0)
        {
            var existing = await db.Set<IdentityUserView>()
                .Where(u => !u.IsDeleted && pfEmails.Contains(u.Email.ToLower()))
                .Select(u => new { u.Email, u.TenantId })
                .ToListAsync(ct);
            foreach (var e in existing) taken[e.Email] = e.TenantId;
        }

        var currentTenant = Softaxis.BuildingBlocks.Domain.Multitenancy.TenantAmbient.TenantId;

        var agents = new List<PfAgentDto>(users.Count);
        foreach (var u in users)
        {
            var profileId = u.TryGetProperty("publicProfile", out var pp) && pp.ValueKind == JsonValueKind.Object &&
                            pp.TryGetProperty("id", out var pid) && pid.TryGetInt32(out var pi) ? pi : (int?)null;

            var email = u.TryGetProperty("email", out var em) ? em.GetString()?.Trim() : null;
            var baseRole = u.TryGetProperty("role", out var r) && r.ValueKind == JsonValueKind.Object
                ? r.TryGetProperty("baseRoleKey", out var brk) ? brk.GetString() : null
                : null;
            var roleName = u.TryGetProperty("role", out var r2) && r2.ValueKind == JsonValueKind.Object
                ? r2.TryGetProperty("name", out var rn) ? rn.GetString() : null
                : null;

            string? note = null;
            var inUse = email is not null && taken.TryGetValue(email, out var ownerTenant);
            if (inUse)
            {
                taken.TryGetValue(email!, out var ownerTenant2);
                note = ownerTenant2 == currentTenant
                    ? "Already has a login in this workspace — will be linked, not re-created."
                    : "This email already belongs to a login in another workspace. Logins are unique platform-wide, so it cannot be created here.";
            }

            agents.Add(new PfAgentDto(
                PfUserId:        u.TryGetProperty("id", out var uid) && uid.TryGetInt32(out var ui) ? ui : 0,
                PublicProfileId: profileId,
                FullName:        $"{Str(u, "firstName")} {Str(u, "lastName")}".Trim(),
                Email:           email,
                Mobile:          Str(u, "mobile"),
                Status:          Str(u, "status") ?? "unknown",
                RoleName:        roleName,
                BaseRoleKey:     baseRole,
                LeadCount:       profileId is { } p2 ? leadsByProfile.GetValueOrDefault(p2) : 0,
                SuggestedRole:   SuggestRole(baseRole),
                EmailInUse:      inUse,
                EmailInUseNote:  note));
        }

        // Agents referenced by leads that no longer exist as PF users — their leads have no owner
        // to map to, so they need a fallback assignee rather than silently going unassigned.
        var knownProfiles = agents.Where(a => a.PublicProfileId is not null)
                                  .Select(a => a.PublicProfileId!.Value).ToHashSet();
        var orphanLeads = leadsByProfile.Where(kv => !knownProfiles.Contains(kv.Key)).Sum(kv => kv.Value);

        var dto = new PfImportPreviewDto(
            Roles: roles.Select(r => new PfRoleDto(
                r.TryGetProperty("id", out var i) && i.TryGetInt32(out var iv) ? iv : 0,
                Str(r, "name") ?? "", Str(r, "roleKey") ?? "", Str(r, "baseRoleKey") ?? "",
                r.TryGetProperty("isCustom", out var c2) && c2.ValueKind == JsonValueKind.True)).ToList(),
            Agents: agents.OrderByDescending(a => a.LeadCount).ThenBy(a => a.FullName).ToList(),
            TotalPfUsers:          users.Count,
            ActivePfUsers:         agents.Count(a => a.Status == "active"),
            AgentsOwningLeads:     agents.Count(a => a.LeadCount > 0),
            TotalLeads:            leads.Count,
            LeadsWithKnownAgent:   leads.Count - orphanLeads,
            LeadsWithUnknownAgent: orphanLeads,
            DistinctPeople:        phones.Distinct(StringComparer.OrdinalIgnoreCase).Count(),
            RepeatEnquiries:       phones.Count - phones.Distinct(StringComparer.OrdinalIgnoreCase).Count(),
            OldestLeadAt:          oldest,
            NewestLeadAt:          newest);

        return Result.Success(dto);
    }

    /// <summary>
    /// Property Finder base role → the Vrodux role we propose.
    ///
    /// The tiers matter: an <c>agent</c> gets the ASSIGNED tier so they see only their own leads,
    /// which is the entire point of importing lead ownership. Giving every agent the tenant-wide
    /// CRM Manager role would let all 69 of them see all 6,962 leads.
    /// </summary>
    private static string? SuggestRole(string? baseRoleKey) => baseRoleKey switch
    {
        "agent"          => "PF Agent",       // crm.leads-assigned.*  — own leads only
        "advisor"        => "PF Agent",
        "decision_maker" => "PF Team Lead",   // crm.leads-team.*      — their team's leads
        "admin"          => "CRM Manager",    // tenant-wide
        "basic_admin"    => "CRM Manager",
        _                => null,             // finance / basic_user own no leads — no CRM role
    };

    private static string? Str(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()?.Trim() : null;
}
