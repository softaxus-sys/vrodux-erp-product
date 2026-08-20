using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Creates a tenant's default role set: an Administrator (all permissions) plus the default
/// roles each enabled module defines in ModuleRoleCatalogue. Roles are added to the current unit of work — the
/// caller is responsible for committing. Returns the Administrator role so the caller
/// can assign it to the tenant's first admin user.
/// </summary>
public interface ITenantRoleProvisioner
{
    Task<Role> ProvisionAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default);

    /// <summary>
    /// Adds any default module role the tenant is missing, without touching roles it already has.
    /// Idempotent — runs on every startup so tenants created before a module (or before a role
    /// template existed) pick it up automatically. Returns how many roles were added.
    /// </summary>
    Task<int> EnsureModuleRolesAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default);
}
