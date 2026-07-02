using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Creates a tenant's default role set: an Administrator (all permissions) plus one
/// Manager role per enabled module. Roles are added to the current unit of work — the
/// caller is responsible for committing. Returns the Administrator role so the caller
/// can assign it to the tenant's first admin user.
/// </summary>
public interface ITenantRoleProvisioner
{
    Task<Role> ProvisionAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default);
}
