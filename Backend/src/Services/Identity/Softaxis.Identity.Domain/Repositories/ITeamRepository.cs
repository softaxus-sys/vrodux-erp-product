using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

/// <summary>Minimal user projection needed to render a team's membership.</summary>
public sealed record TeamUserInfo(Guid Id, string FullName, string Email);

/// <summary>
/// Team persistence. Async here (rather than exposing IQueryable) because the Application layer
/// has no EF Core reference by design — the query stays behind the repository.
/// </summary>
public interface ITeamRepository
{
    Task<List<Team>> GetAllAsync(Guid? tenantScope, string? search, CancellationToken ct = default);

    /// <summary>Loads a single team with its members.</summary>
    Task<Team?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<bool> NameExistsAsync(Guid? tenantScope, string name, CancellationToken ct = default);

    /// <summary>True when the user exists and belongs to <paramref name="tenantScope"/> (any tenant when null).</summary>
    Task<bool> UserBelongsToTenantAsync(Guid userId, Guid? tenantScope, CancellationToken ct = default);

    Task<List<TeamUserInfo>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default);

    /// <summary>Every user id in the teams led by <paramref name="teamLeadUserId"/>, including the lead.</summary>
    Task<List<Guid>> GetMemberIdsOfTeamsLedByAsync(Guid teamLeadUserId, Guid? tenantScope, CancellationToken ct = default);

    /// <summary>All active users of a tenant — the assignable pool for an admin.</summary>
    Task<List<TeamUserInfo>> GetActiveTenantUsersAsync(Guid? tenantScope, CancellationToken ct = default);

    /// <summary>
    /// Active users who could actually lead a team — those whose effective permissions include any
    /// CRM team-tier key (<c>crm.*-team.*</c>), plus super admins. Selected by capability rather
    /// than by role name so it holds for any tenant's own role naming.
    /// </summary>
    Task<List<TeamUserInfo>> GetTeamLeadCandidatesAsync(Guid? tenantScope, CancellationToken ct = default);

    void Add(Team team);
}
