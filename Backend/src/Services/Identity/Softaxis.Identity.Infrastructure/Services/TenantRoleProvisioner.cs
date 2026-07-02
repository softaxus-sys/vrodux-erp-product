using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Services;

/// <inheritdoc />
public sealed class TenantRoleProvisioner(IdentityDbContext db) : ITenantRoleProvisioner
{
    // module prefix → seeded "Manager" role name. Settings is intentionally excluded
    // (admin-only); the Administrator role already covers it.
    private static readonly Dictionary<string, string> ModuleManagerLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["crm"]                = "CRM Manager",
        ["sales"]              = "Sales Manager",
        ["purchase"]           = "Purchase Manager",
        ["finance"]            = "Finance Manager",
        ["hr"]                 = "HR Manager",
        ["inventory"]          = "Inventory Manager",
        ["pos"]                = "POS Manager",
        ["project-management"] = "Project Manager",
        ["b2b"]                = "B2B Manager",
        ["education"]          = "Education Manager",
        ["healthcare"]         = "Healthcare Manager",
        ["insurance"]          = "Insurance Manager",
    };

    public async Task<Role> ProvisionAsync(Guid tenantId, IReadOnlyList<string> enabledModules, CancellationToken ct = default)
    {
        var allPerms = await db.Permissions.AsNoTracking().ToListAsync(ct);

        // Administrator — full access, system role (not editable/deletable by the tenant).
        var admin = Role.Create("Administrator", "Full system access — all modules and operations.",
            isSystem: true, tenantId: tenantId).Value;
        admin.SetPermissions(allPerms.Select(p => p.Id));
        db.Roles.Add(admin);

        // One Manager role per enabled module (falls back to all known modules if none resolved).
        var modules = (enabledModules is { Count: > 0 } ? enabledModules : ModuleManagerLabels.Keys.ToList())
            .Select(m => m.Trim())
            .Where(m => m.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var mod in modules)
        {
            if (!ModuleManagerLabels.TryGetValue(mod, out var label)) continue;

            var perms = allPerms
                .Where(p => string.Equals(p.ModuleId.Split('.')[0], mod, StringComparison.OrdinalIgnoreCase))
                .Select(p => p.Id).ToList();
            if (perms.Count == 0) continue;

            var mgr = Role.Create(label, $"Full access to the {label.Replace(" Manager", string.Empty)} module.",
                isSystem: false, tenantId: tenantId).Value;
            mgr.SetPermissions(perms);
            db.Roles.Add(mgr);
        }

        return admin;
    }
}
