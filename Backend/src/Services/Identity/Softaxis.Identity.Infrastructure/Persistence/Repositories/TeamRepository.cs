using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

internal sealed class TeamRepository(IdentityDbContext db) : ITeamRepository
{
    /// <summary>
    /// Teams are tenant-owned. A null scope means super-admin, which sees only global
    /// (TenantId IS NULL) rows — never another tenant's private teams. This mirrors the
    /// RoleRepository fix: `== null` must be written as an explicit IS NULL branch, because
    /// comparing a column to a null parameter never matches in SQL.
    /// </summary>
    private IQueryable<Team> Scoped(Guid? tenantScope)
    {
        var q = db.Teams.Where(t => !t.IsDeleted);
        return tenantScope.HasValue
            ? q.Where(t => t.TenantId == tenantScope.Value)
            : q.Where(t => t.TenantId == null);
    }

    public async Task<List<Team>> GetAllAsync(Guid? tenantScope, string? search, CancellationToken ct = default)
    {
        var q = Scoped(tenantScope).Include(t => t.Members);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(t => t.Name.Contains(s)).Include(t => t.Members);
        }

        return await q.OrderBy(t => t.Name).ToListAsync(ct);
    }

    public Task<Team?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Teams.Include(t => t.Members).FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct);

    public Task<bool> NameExistsAsync(Guid? tenantScope, string name, CancellationToken ct = default) =>
        Scoped(tenantScope).AnyAsync(t => t.Name == name.Trim(), ct);

    public Task<bool> UserBelongsToTenantAsync(Guid userId, Guid? tenantScope, CancellationToken ct = default) =>
        tenantScope.HasValue
            ? db.Users.AnyAsync(u => u.Id == userId && u.TenantId == tenantScope.Value, ct)
            : db.Users.AnyAsync(u => u.Id == userId, ct);

    public async Task<List<TeamUserInfo>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default)
    {
        if (userIds.Count == 0) return [];

        var rows = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
            .ToListAsync(ct);

        // FullName is a computed property, so the name is assembled after materialising.
        return rows
            .Select(u => new TeamUserInfo(u.Id, $"{u.FirstName} {u.LastName}".Trim(), u.Email))
            .ToList();
    }

    public async Task<Dictionary<Guid, List<UserTeamRef>>> GetTeamsByUserAsync(
        IReadOnlyCollection<Guid> userIds, Guid? tenantScope, CancellationToken ct = default)
    {
        if (userIds.Count == 0) return [];

        // Joined through the tenant-scoped team query so a membership row can never surface a team
        // from another tenant.
        var rows = await Scoped(tenantScope)
            .Where(t => t.IsActive)
            .SelectMany(t => db.TeamMembers
                .Where(m => m.TeamId == t.Id && userIds.Contains(m.UserId))
                .Select(m => new { m.UserId, TeamId = t.Id, t.Name }))
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(r => new UserTeamRef(r.TeamId, r.Name))
                      .DistinctBy(x => x.TeamId).OrderBy(x => x.Name).ToList());
    }

    public Task<List<Guid>> GetAllTeamLeadIdsAsync(Guid? tenantScope, CancellationToken ct = default) =>
        Scoped(tenantScope)
            .Where(t => t.IsActive && t.TeamLeadUserId != null)
            .Select(t => t.TeamLeadUserId!.Value)
            .Distinct()
            .ToListAsync(ct);

    public async Task<List<Guid>> GetLeadIdsOfTeamsContainingAsync(
        Guid userId, Guid? tenantScope, CancellationToken ct = default)
    {
        var teamIds = await db.TeamMembers
            .Where(m => m.UserId == userId)
            .Select(m => m.TeamId)
            .ToListAsync(ct);

        if (teamIds.Count == 0) return [];

        return await Scoped(tenantScope)
            .Where(t => t.IsActive && teamIds.Contains(t.Id) && t.TeamLeadUserId != null)
            .Select(t => t.TeamLeadUserId!.Value)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<Guid>> GetMemberIdsOfTeamsLedByAsync(
        Guid teamLeadUserId, Guid? tenantScope, CancellationToken ct = default)
    {
        // A user may lead more than one team — the union of all of them is what they can see.
        var teamIds = await Scoped(tenantScope)
            .Where(t => t.IsActive && t.TeamLeadUserId == teamLeadUserId)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (teamIds.Count == 0) return [];

        var memberIds = await db.TeamMembers
            .Where(m => teamIds.Contains(m.TeamId))
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(ct);

        // The lead is normally stored as a member too, but include them defensively so a team whose
        // membership row was removed by hand still scopes to at least its own lead.
        if (!memberIds.Contains(teamLeadUserId)) memberIds.Add(teamLeadUserId);

        return memberIds;
    }

    public async Task<List<TeamUserInfo>> GetTeamLeadCandidatesAsync(Guid? tenantScope, CancellationToken ct = default)
    {
        var q = db.Users.AsNoTracking().Where(u => u.Status == UserStatus.Active);
        if (tenantScope.HasValue) q = q.Where(u => u.TenantId == tenantScope.Value);

        // Effective permission = (role grants ∪ user grants) − user denies, the same formula the JWT
        // is built from, so this list can never offer someone the guard would then ignore.
        q = q.Where(u => u.IsSuperAdmin || db.Set<Permission>().Any(p =>
                p.ModuleId.StartsWith("crm.") && p.ModuleId.EndsWith("-team") &&
                (u.UserPermissions.Any(up => up.PermissionId == p.Id && up.IsGranted)
                 || (u.UserRoles.Any(ur => ur.Role.RolePermissions.Any(rp => rp.PermissionId == p.Id))
                     && !u.UserPermissions.Any(up => up.PermissionId == p.Id && !up.IsGranted)))));

        var candidates = await q
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
            .ToListAsync(ct);

        return candidates
            .Select(u => new TeamUserInfo(u.Id, $"{u.FirstName} {u.LastName}".Trim(), u.Email))
            .OrderBy(u => u.FullName)
            .ToList();
    }

    public async Task<List<TeamUserInfo>> GetActiveTenantUsersAsync(Guid? tenantScope, CancellationToken ct = default)
    {
        var q = db.Users.AsNoTracking().Where(u => u.Status == UserStatus.Active);
        if (tenantScope.HasValue) q = q.Where(u => u.TenantId == tenantScope.Value);

        var rows = await q
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
            .ToListAsync(ct);

        return rows
            .Select(u => new TeamUserInfo(u.Id, $"{u.FirstName} {u.LastName}".Trim(), u.Email))
            .OrderBy(u => u.FullName)
            .ToList();
    }

    public void Add(Team team) => db.Teams.Add(team);

    /// <inheritdoc />
    public async Task<HashSet<Guid>> FilterUsersWithModuleAccessAsync(
        IReadOnlyCollection<Guid> userIds, string modulePrefix, CancellationToken ct = default)
    {
        if (userIds.Count == 0 || string.IsNullOrWhiteSpace(modulePrefix)) return [];

        // "crm" must match crm.leads and crm.pipeline but never crm-something-else, so the dot is
        // part of the prefix. A key that is exactly the module ("reports") is matched too.
        var prefix = modulePrefix.Trim().TrimEnd('.');
        var dotted = prefix + ".";

        var moduleIds = userIds.ToList();

        var fromRoles = await db.Users.AsNoTracking()
            .Where(u => moduleIds.Contains(u.Id))
            .SelectMany(u => u.UserRoles.Select(ur => new { UserId = u.Id, ur.RoleId }))
            .Join(db.Roles.AsNoTracking().SelectMany(r => r.RolePermissions.Select(rp => new { rp.RoleId, rp.PermissionId })),
                  x => x.RoleId, y => y.RoleId, (x, y) => new { x.UserId, y.PermissionId })
            .Join(db.Permissions.AsNoTracking().Where(p => p.ModuleId == prefix || p.ModuleId.StartsWith(dotted)),
                  x => x.PermissionId, p => p.Id, (x, _) => new { x.UserId, x.PermissionId })
            .ToListAsync(ct);

        // Per-user overrides: a grant can add access the roles do not give, and a deny can remove
        // the only one they do. Both have to be applied or the picker disagrees with the JWT.
        var overrides = await db.UserPermissions.AsNoTracking()
            .Where(up => moduleIds.Contains(up.UserId))
            .Join(db.Permissions.AsNoTracking().Where(p => p.ModuleId == prefix || p.ModuleId.StartsWith(dotted)),
                  up => up.PermissionId, p => p.Id, (up, _) => new { up.UserId, up.PermissionId, up.IsGranted })
            .ToListAsync(ct);

        var denied = overrides.Where(o => !o.IsGranted)
                              .Select(o => (o.UserId, o.PermissionId))
                              .ToHashSet();

        var effective = fromRoles.Select(r => (r.UserId, r.PermissionId))
            .Concat(overrides.Where(o => o.IsGranted).Select(o => (o.UserId, o.PermissionId)))
            .Where(pair => !denied.Contains(pair));

        return effective.Select(p => p.UserId).ToHashSet();
    }
}
