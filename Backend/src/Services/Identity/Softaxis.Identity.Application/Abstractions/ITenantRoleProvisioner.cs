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

    /// <summary>
    /// Grants template roles the permission keys that did not exist when those roles were created.
    /// <para>Only ever adds a key that <b>no tenant-owned role anywhere holds</b> — true exactly
    /// once, for a freshly seeded key. That self-limiting test is what stops this from undoing a
    /// tenant which deliberately narrowed one of its roles: any key already granted to somebody is
    /// left alone forever.</para>
    /// Returns how many grants were made.
    /// </summary>
    Task<int> SyncNewTemplatePermissionsAsync(CancellationToken ct = default);

    /// <summary>
    /// Gives every role that can take restaurant orders the till-shift keys (pos.sessions
    /// view/create) it needs to do so: the order screen sits behind the shift gate, so a role
    /// without them can open nothing. Roles created before the restaurant templates carried those
    /// keys never got them, and <see cref="SyncNewTemplatePermissionsAsync"/> cannot help — the
    /// keys are old, only their place in these roles is new. Idempotent. Returns the grants made.
    /// </summary>
    Task<int> EnsureRestaurantShiftAccessAsync(CancellationToken ct = default);
}
