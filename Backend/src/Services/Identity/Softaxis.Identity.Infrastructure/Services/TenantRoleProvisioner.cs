using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Seed;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Services;

/// <inheritdoc />
public sealed class TenantRoleProvisioner(IdentityDbContext db) : ITenantRoleProvisioner
{
    public async Task<Role> ProvisionAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default)
    {
        var allPerms = await db.Permissions.AsNoTracking().ToListAsync(ct);

        // Administrator — full access, system role (not editable/deletable by the tenant).
        var admin = Role.Create("Administrator", "Full system access — all modules and operations.",
            isSystem: true, tenantId: tenantId).Value;
        admin.SetPermissions(allPerms.Select(p => p.Id));
        db.Roles.Add(admin);

        await AddMissingModuleRolesAsync(tenantId, enabledModules, allPerms, existing: [], ct);
        return admin;
    }

    /// <inheritdoc />
    public async Task<int> EnsureModuleRolesAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default)
    {
        // No resolvable modules → do nothing. ProvisionAsync falls back to "every known module" for a
        // brand-new tenant, but applying that fallback to an EXISTING tenant on every startup would
        // bury it in roles for modules it doesn't own.
        if (enabledModules is not { Count: > 0 }) return 0;

        var allPerms = await db.Permissions.AsNoTracking().ToListAsync(ct);

        // Match on name so a role the tenant already has — whether seeded earlier or created by
        // hand — is never duplicated, and its permissions are never overwritten.
        var existing = await db.Roles
            .Where(r => r.TenantId == tenantId && !r.IsDeleted)
            .Select(r => r.Name)
            .ToListAsync(ct);

        return await AddMissingModuleRolesAsync(tenantId, enabledModules, allPerms,
            existing.ToHashSet(StringComparer.OrdinalIgnoreCase), ct);
    }

    /// <summary>
    /// Adds every catalogue role for the tenant's enabled modules that does not already exist.
    /// A template granting no permissions at all is skipped — that means the module's permission
    /// keys aren't seeded yet, and an empty role would just be confusing clutter.
    /// </summary>
    private Task<int> AddMissingModuleRolesAsync(
        Guid tenantId,
        IReadOnlyList<string> enabledModules,
        List<Permission> allPerms,
        HashSet<string> existing,
        CancellationToken ct)
    {
        // Fall back to every known module when a tenant has none resolved, matching prior behaviour.
        var modules = (enabledModules is { Count: > 0 } ? enabledModules : [.. ModuleRoleCatalogue.ModuleLabels.Keys])
            .Select(m => m.Trim())
            .Where(m => m.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        var added = 0;

        foreach (var module in modules)
        foreach (var template in ModuleRoleCatalogue.For(module))
        {
            if (existing.Contains(template.Name)) continue;

            var perms = allPerms
                .Where(p => template.Includes(p.ModuleId, p.Action))
                .Select(p => p.Id)
                .ToList();
            if (perms.Count == 0) continue;

            var role = Role.Create(template.Name, template.Description, isSystem: false, tenantId: tenantId).Value;
            role.SetPermissions(perms);
            db.Roles.Add(role);

            // Guards against two modules contributing the same role name in one pass.
            existing.Add(template.Name);
            added++;
        }

        _ = ct;
        return Task.FromResult(added);
    }

    /// <inheritdoc />
    public async Task<int> SyncNewTemplatePermissionsAsync(CancellationToken ct = default)
    {
        var allPerms = await db.Permissions.AsNoTracking().ToListAsync(ct);
        if (allPerms.Count == 0) return 0;

        // Tenant-owned, non-system roles: the ones built from a catalogue template. Administrator
        // is excluded deliberately — it already holds every key via SyncAdministratorPermissions,
        // so counting it would make every key look "already granted" and this a permanent no-op.
        var roles = await db.Roles
            .Include(r => r.RolePermissions)
            .Where(r => r.TenantId != null && !r.IsSystem && !r.IsDeleted)
            .ToListAsync(ct);
        if (roles.Count == 0) return 0;

        var alreadyGranted = roles.SelectMany(r => r.RolePermissions)
                                  .Select(rp => rp.PermissionId)
                                  .ToHashSet();

        var newPerms = allPerms.Where(p => !alreadyGranted.Contains(p.Id)).ToList();
        if (newPerms.Count == 0) return 0;

        // Role name → the template that defines it. Names are unique per module label
        // ("HR Manager", "CRM Manager"), so the first match wins.
        var templates = new Dictionary<string, Func<string, string, bool>>(StringComparer.OrdinalIgnoreCase);
        foreach (var module in ModuleRoleCatalogue.ModuleLabels.Keys)
        foreach (var template in ModuleRoleCatalogue.For(module))
            templates.TryAdd(template.Name, template.Includes);

        var granted = 0;
        foreach (var role in roles)
        {
            if (!templates.TryGetValue(role.Name, out var includes)) continue;

            foreach (var p in newPerms.Where(p => includes(p.ModuleId, p.Action)))
            {
                role.AddPermission(p.Id);   // idempotent on the entity
                granted++;
            }
        }

        if (granted > 0) await db.SaveChangesAsync(ct);
        return granted;
    }
}
