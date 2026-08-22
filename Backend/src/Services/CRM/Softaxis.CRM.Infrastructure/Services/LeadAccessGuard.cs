using Softaxis.BuildingBlocks.Domain.Multitenancy;
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
///   <item><b>Team</b> — <c>crm.{area}-team.view</c> / <c>.edit</c>: records <b>filed to</b> a team this
///     user leads (see <c>TeamId</c>), plus their own. Filing is what makes this unambiguous: an owner
///     can belong to several teams, so ownership alone cannot say whose work a record is. A record with
///     no team is visible to its owner and to the Full tier only — never to a team lead.</item>
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

    /// <summary>
    /// Teams the caller may see performance for, with their members. Full-access holders and super
    /// admins get every active team in the tenant; everyone else gets only the teams they lead.
    /// A rep who leads nothing gets an empty list, so a team-grouped report shows them nothing
    /// rather than a team they have no business seeing.
    /// </summary>
    Task<IReadOnlyList<VisibleTeam>> VisibleTeamsAsync(CancellationToken ct);

    /// <summary>
    /// The caller's team when that is unambiguous — i.e. they belong to exactly one active team.
    /// Null when they belong to none, or to several (filing then needs an explicit choice, since
    /// guessing would hide the record from a team lead who legitimately had it). Used to file a
    /// record the caller just created without asking them a question they usually can't answer wrong.
    /// </summary>
    Task<Guid?> SoleTeamOfCurrentUserAsync(CancellationToken ct);
}

/// <summary>One team the caller may report on, with the user ids belonging to it.</summary>
public sealed record VisibleTeam(Guid Id, string Name, Guid? TeamLeadUserId, IReadOnlyList<Guid> MemberUserIds);

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

    /// <summary>
    /// Tenant-wide authority over one CRM area. Used as a fast path before the per-record checks.
    /// <para>
    /// Deliberately takes the AREA. It used to be a single lead-only check applied to every target
    /// type, which meant anyone holding <c>crm.leads.edit</c> could manage activities and documents on
    /// opportunities and accounts they had no permission to see — the wrong module's key granting
    /// access to another module's records.
    /// </para>
    /// </summary>
    private bool CanManageFreely(string area) =>
        user.IsSuperAdmin
        || user.HasPermission($"crm.{area}.create")
        || user.HasPermission($"crm.{area}.edit");

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

    /// <summary>Team ids the caller leads. Cached per request, like <see cref="TeamUserIdsAsync"/>.</summary>
    private List<Guid>? _ledTeamIds;

    private async Task<List<Guid>> LedTeamIdsAsync(CancellationToken ct)
    {
        if (_ledTeamIds is not null) return _ledTeamIds;
        if (user.Id is not { } uid) return _ledTeamIds = [];

        return _ledTeamIds = await db.Set<IdentityTeamView>()
            .Where(t => t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted)
            .Select(t => t.Id)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Shared per-record decision. Mirrors the query-side rule exactly: a team lead covers only the
    /// records filed to a team they lead; the owner always covers their own.
    /// </summary>
    private async Task<bool> OwnerAllowedAsync(
        string area, string action, Guid? ownerId, Guid? teamId, CancellationToken ct)
    {
        if (All(area, action)) return true;
        if (user.Id is not { } uid) return false;

        // A "view" check also passes for someone who may edit — editing implies reading.
        var tier = Team(area, action) || (action == "view" && Team(area, "edit"));
        var own  = Assigned(area, action) || (action == "view" && Assigned(area, "edit"));

        if (ownerId == uid && (own || tier)) return true;
        if (!tier) return false;

        // Team tier covers only records filed to a team this user leads. An untagged record is not
        // theirs to act on — see the note in ScopeReadable for why the owner-membership fallback was
        // removed rather than kept as a safety net.
        return teamId is { } tid && (await LedTeamIdsAsync(ct)).Contains(tid);
    }

    // ── Leads ────────────────────────────────────────────────────────────────
    public IQueryable<Lead> ScopeReadable(IQueryable<Lead> source)
    {
        if (CanViewAll) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (CanViewTeam)
            return source.Where(l =>
                l.AssignedToUserId == uid ||
                // A team lead sees a record ONLY when it is filed to a team they lead. Untagged
                // records are deliberately NOT included: falling back to owner membership sounded
                // safe but meant a multi-team owner's records stayed visible to every one of their
                // leads forever — the exact ambiguity this exists to remove. Untagged records remain
                // visible to their owner and to full-access roles, so nothing is unreachable.
                (l.TeamId != null && db.Set<IdentityTeamView>()
                    .Any(t => t.Id == l.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted)));

        if (CanViewAssigned) return source.Where(l => l.AssignedToUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadAsync(Lead lead, CancellationToken ct) =>
        OwnerAllowedAsync("leads", "view", lead.AssignedToUserId, lead.TeamId, ct);

    public Task<bool> CanEditAsync(Lead lead, CancellationToken ct) =>
        OwnerAllowedAsync("leads", "edit", lead.AssignedToUserId, lead.TeamId, ct);

    // ── Opportunities ────────────────────────────────────────────────────────
    public IQueryable<Deal> ScopeDeals(IQueryable<Deal> source)
    {
        if (All("pipeline", "view")) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (Team("pipeline", "view"))
            return source.Where(d =>
                d.AssignedToUserId == uid ||
                (d.TeamId != null && db.Set<IdentityTeamView>()
                    .Any(t => t.Id == d.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted)));

        if (Assigned("pipeline", "view")) return source.Where(d => d.AssignedToUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadDealAsync(Deal deal, CancellationToken ct) =>
        OwnerAllowedAsync("pipeline", "view", deal.AssignedToUserId, deal.TeamId, ct);

    public Task<bool> CanEditDealAsync(Deal deal, CancellationToken ct) =>
        OwnerAllowedAsync("pipeline", "edit", deal.AssignedToUserId, deal.TeamId, ct);

    // ── Accounts ─────────────────────────────────────────────────────────────
    public IQueryable<CrmCustomer> ScopeCustomers(IQueryable<CrmCustomer> source)
    {
        if (All("customers", "view")) return source;
        if (user.Id is not { } uid) return source.Where(_ => false);

        if (Team("customers", "view"))
            return source.Where(c =>
                c.AccountManagerUserId == uid ||
                (c.TeamId != null && db.Set<IdentityTeamView>()
                    .Any(t => t.Id == c.TeamId && t.TeamLeadUserId == uid && t.IsActive && !t.IsDeleted)));

        if (Assigned("customers", "view")) return source.Where(c => c.AccountManagerUserId == uid);
        return source.Where(_ => false);
    }

    public Task<bool> CanReadCustomerAsync(CrmCustomer customer, CancellationToken ct) =>
        OwnerAllowedAsync("customers", "view", customer.AccountManagerUserId, customer.TeamId, ct);

    public Task<bool> CanEditCustomerAsync(CrmCustomer customer, CancellationToken ct) =>
        OwnerAllowedAsync("customers", "edit", customer.AccountManagerUserId, customer.TeamId, ct);

    // ── Activities ───────────────────────────────────────────────────────────
    public async Task<bool> CanManageActivityAsync(string? relatedToType, Guid relatedToId, CancellationToken ct)
    {
        if (user.Id is not { } uid) return false;

        var type = relatedToType?.Trim().ToLowerInvariant();

        // An activity or document inherits the permissions of the record it hangs off.
        if (type == "deal")
        {
            if (CanManageFreely("pipeline")) return true;
            var rec = await db.Deals.AsNoTracking().Where(d => d.Id == relatedToId)
                .Select(d => new { d.AssignedToUserId, d.TeamId }).FirstOrDefaultAsync(ct);
            return await OwnerAllowedAsync("pipeline", "edit", rec?.AssignedToUserId, rec?.TeamId, ct);
        }

        if (type == "customer" || type == "contact")
        {
            if (CanManageFreely("customers")) return true;
            var rec = await db.Customers.AsNoTracking().Where(c => c.Id == relatedToId)
                .Select(c => new { c.AccountManagerUserId, c.TeamId }).FirstOrDefaultAsync(ct);
            return await OwnerAllowedAsync("customers", "edit", rec?.AccountManagerUserId, rec?.TeamId, ct);
        }

        if (type != "lead") return false;
        if (CanManageFreely("leads")) return true;

        if (CanEditAssigned &&
            await db.Leads.AsNoTracking().AnyAsync(l => l.Id == relatedToId && l.AssignedToUserId == uid, ct))
            return true;

        if (CanEditTeam)
        {
            // Same tagged/untagged rule as the list query, so a lead the team lead cannot see in the
            // list cannot have activities or documents managed on it either.
            var rec = await db.Leads.AsNoTracking()
                .Where(l => l.Id == relatedToId)
                .Select(l => new { l.AssignedToUserId, l.TeamId })
                .FirstOrDefaultAsync(ct);
            if (rec is null) return false;
            if (rec.AssignedToUserId == uid) return true;
            // Untagged records are not a team lead's to manage — same rule as the list query.
            return rec.TeamId is { } tid && (await LedTeamIdsAsync(ct)).Contains(tid);
        }

        return false;
    }

    public async Task<Guid?> SoleTeamOfCurrentUserAsync(CancellationToken ct)
    {
        if (user.Id is not { } uid) return null;

        // Take two: enough to tell "exactly one" from "more than one" without loading every row.
        var teamIds = await db.Set<IdentityTeamMemberView>()
            .Where(m => m.UserId == uid
                     && db.Set<IdentityTeamView>().Any(t => t.Id == m.TeamId && t.IsActive && !t.IsDeleted))
            .Select(m => m.TeamId)
            .Distinct()
            .Take(2)
            .ToListAsync(ct);

        return teamIds.Count == 1 ? teamIds[0] : null;
    }

    public async Task<IReadOnlyList<VisibleTeam>> VisibleTeamsAsync(CancellationToken ct)
    {
        var teamQuery = db.Set<IdentityTeamView>().Where(t => t.IsActive && !t.IsDeleted);

        if (CanViewAll)
        {
            // The team views carry Identity's own TenantId and sit outside the CRM namespace filter,
            // so tenant scoping has to be applied by hand here — otherwise a full-access user would
            // see every tenant's teams.
            var tenantId = TenantAmbient.TenantId;
            teamQuery = tenantId is { } tid
                ? teamQuery.Where(t => t.TenantId == tid)
                // Unresolved tenant (never a normal request path) matches nothing rather than everything.
                : teamQuery.Where(_ => false);
        }
        else if (user.Id is { } uid)
        {
            teamQuery = teamQuery.Where(t => t.TeamLeadUserId == uid);
        }
        else
        {
            return [];
        }

        var teams = await teamQuery
            .Select(t => new { t.Id, t.Name, t.TeamLeadUserId })
            .ToListAsync(ct);

        if (teams.Count == 0) return [];

        var teamIds = teams.Select(t => t.Id).ToList();
        var members = await db.Set<IdentityTeamMemberView>()
            .Where(m => teamIds.Contains(m.TeamId))
            .Select(m => new { m.TeamId, m.UserId })
            .ToListAsync(ct);

        var byTeam = members.GroupBy(m => m.TeamId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(m => m.UserId).Distinct().ToList());

        return teams
            .Select(t => new VisibleTeam(
                t.Id, t.Name, t.TeamLeadUserId,
                byTeam.TryGetValue(t.Id, out var ids) ? ids : []))
            .OrderBy(t => t.Name)
            .ToList();
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
