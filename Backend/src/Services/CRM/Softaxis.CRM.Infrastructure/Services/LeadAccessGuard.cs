using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Record-level visibility for CRM. Three tiers apply independently to <b>leads</b>,
/// <b>opportunities</b> and <b>accounts</b>, from widest to narrowest:
/// <list type="bullet">
///   <item><b>Full</b> — <c>crm.{area}.view</c> / <c>.edit</c> (or super admin): everything in the tenant.</item>
///   <item><b>Team</b> — <c>crm.{area}-team.view</c> / <c>.edit</c>: records owned by anyone in a team
///     this user leads, their own included. Leading several teams gives the union.</item>
///   <item><b>Assigned</b> — <c>crm.{area}-assigned.view</c> / <c>.edit</c>: only records owned by this user.</item>
/// </list>
/// where <c>{area}</c> is <c>leads</c>, <c>pipeline</c> or <c>customers</c>. Grant one tier per area;
/// holding several is harmless (the widest wins). Unowned records are visible only to the Full tier,
/// so admin → team lead → member stays the deliberate routing path.
/// </summary>
public interface ILeadAccessGuard
{
    bool CanViewAll      { get; }
    bool CanViewTeam     { get; }
    bool CanViewAssigned { get; }
    bool CanEditAll      { get; }
    bool CanEditTeam     { get; }
    bool CanEditAssigned { get; }

    IQueryable<Lead> ScopeReadable(IQueryable<Lead> source);
    Task<bool> CanReadAsync(Lead lead, CancellationToken ct);
    Task<bool> CanEditAsync(Lead lead, CancellationToken ct);

    /// <summary>Narrow an opportunity query to what the caller may read (crm.pipeline* tiers).</summary>
    IQueryable<Deal> ScopeDeals(IQueryable<Deal> source);
    Task<bool> CanReadDealAsync(Deal deal, CancellationToken ct);
    Task<bool> CanEditDealAsync(Deal deal, CancellationToken ct);

    /// <summary>Narrow an account query to what the caller may read (crm.customers* tiers).</summary>
    IQueryable<CrmCustomer> ScopeCustomers(IQueryable<CrmCustomer> source);
    Task<bool> CanReadCustomerAsync(CrmCustomer customer, CancellationToken ct);
    Task<bool> CanEditCustomerAsync(CrmCustomer customer, CancellationToken ct);

    Task<bool> CanManageActivityAsync(string? relatedToType, Guid relatedToId, CancellationToken ct);
    IQueryable<Activity> ScopeActivities(IQueryable<Activity> source);
}

internal sealed class LeadAccessGuard(CrmDbContext db, ICurrentUser user) : ILeadAccessGuard
{
    // ── Tier resolution, shared by all three areas ───────────────────────────
    private bool All(string area, string action) =>
        user.IsSuperAdmin || user.HasPermission($"crm.{area}.{action}");
    private bool Team(string area, string action) => user.HasPermission($"crm.{area}-team.{action}");
    private bool Assigned(string area, string action) => user.HasPermission($"crm.{area}-assigned.{action}");

    public bool CanViewAll      => All("leads", "view");
    public bool CanViewTeam     => Team("leads", "view");
    public bool CanViewAssigned => Assigned("leads", "view");
    public bool CanEditAll      => All("leads", "edit");
    public bool CanEditTeam     => Team("leads", "edit");
    public bool CanEditAssigned => Assigned("leads", "edit");

    private bool CanManageActivitiesFreely =>
        user.IsSuperAdmin || user.HasPermission("crm.leads.create") || user.HasPermission("crm.leads.edit");

    private bool CanSeeAllActivities => user.IsSuperAdmin || user.HasPermission("crm.leads.view");

    /// <summary>
    /// User ids visible to a team lead — every member of every active team they lead, themselves
    /// included. Cached for the lifetime of the guard, which is scoped per request.
    /// </summary>
    private List<Guid>? _teamUserIds;

    private async Task<List<Guid>> TeamUserIdsAsync(CancellationToken ct)
    {
        if (_teamUserIds is not null) return _teamUserIds;
        if (user.Id is not { } uid) return _teamUserIds = [];

        var ids = await db.Set<IdentityTeamMemberView>()
            .Where(m => db.Set<IdentityTeamView>()
                .Any(t => t.Id == m.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted))
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(ct);

        if (!ids.Contains(uid)) ids.Add(uid);
        return _teamUserIds = ids;
    }

    /// <summary>Shared per-record decision: does the caller's tier for <paramref name="area"/> cover this owner?</summary>
    private async Task<bool> OwnerAllowedAsync(string area, string action, Guid? ownerId, CancellationToken ct)
    {
        if (All(area, action)) return true;
        if (user.Id is not { } uid) return false;

        // A "view" check also passes for someone who may edit — editing implies reading.
        var tier = Team(area, action) || (action == "view" && Team(area, "edit"));
        var own  = Assigned(area, action) || (action == "view" && Assigned(area, "edit"));

        if (own && ownerId == uid) return true;
        if (tier && ownerId is { } owner) return (await TeamUserIdsAsync(ct)).Contains(owner);
        return false;
    }

    // ── Leads ────────────────────────────────────────────────────────────────
    public IQueryable<Lead> ScopeReadable(IQueryable<Lead> source)
    {
        if (CanViewAll) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (CanViewTeam)
            return source.Where(l =>
                l.AssignedToUserId == uid ||
                (l.AssignedToUserId != null && db.Set<IdentityTeamMemberView>()
                    .Any(m => m.UserId == l.AssignedToUserId
                           && db.Set<IdentityTeamView>()
                                .Any(t => t.Id == m.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted))));

        if (CanViewAssigned) return source.Where(l => l.AssignedToUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadAsync(Lead lead, CancellationToken ct) =>
        OwnerAllowedAsync("leads", "view", lead.AssignedToUserId, ct);

    public Task<bool> CanEditAsync(Lead lead, CancellationToken ct) =>
        OwnerAllowedAsync("leads", "edit", lead.AssignedToUserId, ct);

    // ── Opportunities ────────────────────────────────────────────────────────
    public IQueryable<Deal> ScopeDeals(IQueryable<Deal> source)
    {
        if (All("pipeline", "view")) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (Team("pipeline", "view"))
            return source.Where(d =>
                d.AssignedToUserId == uid ||
                (d.AssignedToUserId != null && db.Set<IdentityTeamMemberView>()
                    .Any(m => m.UserId == d.AssignedToUserId
                           && db.Set<IdentityTeamView>()
                                .Any(t => t.Id == m.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted))));

        if (Assigned("pipeline", "view")) return source.Where(d => d.AssignedToUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadDealAsync(Deal deal, CancellationToken ct) =>
        OwnerAllowedAsync("pipeline", "view", deal.AssignedToUserId, ct);

    public Task<bool> CanEditDealAsync(Deal deal, CancellationToken ct) =>
        OwnerAllowedAsync("pipeline", "edit", deal.AssignedToUserId, ct);

    // ── Accounts ─────────────────────────────────────────────────────────────
    public IQueryable<CrmCustomer> ScopeCustomers(IQueryable<CrmCustomer> source)
    {
        if (All("customers", "view")) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (Team("customers", "view"))
            return source.Where(c =>
                c.AccountManagerUserId == uid ||
                (c.AccountManagerUserId != null && db.Set<IdentityTeamMemberView>()
                    .Any(m => m.UserId == c.AccountManagerUserId
                           && db.Set<IdentityTeamView>()
                                .Any(t => t.Id == m.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted))));

        if (Assigned("customers", "view")) return source.Where(c => c.AccountManagerUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadCustomerAsync(CrmCustomer customer, CancellationToken ct) =>
        OwnerAllowedAsync("customers", "view", customer.AccountManagerUserId, ct);

    public Task<bool> CanEditCustomerAsync(CrmCustomer customer, CancellationToken ct) =>
        OwnerAllowedAsync("customers", "edit", customer.AccountManagerUserId, ct);

    // ── Activities ───────────────────────────────────────────────────────────
    public async Task<bool> CanManageActivityAsync(string? relatedToType, Guid relatedToId, CancellationToken ct)
    {
        if (CanManageActivitiesFreely) return true;
        if (user.Id is not { } uid) return false;

        var type = relatedToType?.Trim().ToLowerInvariant();

        // An activity or document inherits the permissions of the record it hangs off.
        if (type == "deal")
        {
            var owner = await db.Deals.AsNoTracking().Where(d => d.Id == relatedToId)
                .Select(d => d.AssignedToUserId).FirstOrDefaultAsync(ct);
            return await OwnerAllowedAsync("pipeline", "edit", owner, ct);
        }

        if (type == "customer" || type == "contact")
        {
            var owner = await db.Customers.AsNoTracking().Where(c => c.Id == relatedToId)
                .Select(c => c.AccountManagerUserId).FirstOrDefaultAsync(ct);
            return await OwnerAllowedAsync("customers", "edit", owner, ct);
        }

        if (type != "lead") return false;

        if (CanEditAssigned &&
            await db.Leads.AsNoTracking().AnyAsync(l => l.Id == relatedToId && l.AssignedToUserId == uid, ct))
            return true;

        if (CanEditTeam)
        {
            var owner = await db.Leads.AsNoTracking()
                .Where(l => l.Id == relatedToId)
                .Select(l => l.AssignedToUserId)
                .FirstOrDefaultAsync(ct);
            return owner is { } o && (await TeamUserIdsAsync(ct)).Contains(o);
        }

        return false;
    }

    public IQueryable<Activity> ScopeActivities(IQueryable<Activity> source)
    {
        if (CanSeeAllActivities) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (CanViewTeam)
            return source.Where(a => a.RelatedToType == "lead"
                && db.Leads.Any(l => l.Id == a.RelatedToId
                    && (l.AssignedToUserId == uid
                        || (l.AssignedToUserId != null && db.Set<IdentityTeamMemberView>()
                            .Any(m => m.UserId == l.AssignedToUserId
                                   && db.Set<IdentityTeamView>()
                                        .Any(t => t.Id == m.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted))))));

        return source.Where(a => a.RelatedToType == "lead"
            && db.Leads.Any(l => l.Id == a.RelatedToId && l.AssignedToUserId == uid));
    }
}
