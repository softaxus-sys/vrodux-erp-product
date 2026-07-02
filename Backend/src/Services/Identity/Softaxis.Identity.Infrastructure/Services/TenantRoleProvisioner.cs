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

        var modList = modules.ToList();

        foreach (var mod in modList)
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

        // POS operational tiers (Cashier / Supervisor) — only for POS-enabled tenants. POS Manager
        // (full) already comes from the per-module set above; these add the limited/shift roles that
        // used to be seeded globally and shared across all tenants.
        if (modList.Any(m => string.Equals(m, "pos", StringComparison.OrdinalIgnoreCase)))
        {
            Guid[] PermsFor(string moduleId, params string[] actions) =>
                [.. allPerms.Where(p => p.ModuleId == moduleId && actions.Contains(p.Action)).Select(p => p.Id)];

            var cashier = Role.Create("Cashier",
                "Process sales at the POS terminal. View products and print receipts.",
                isSystem: false, tenantId: tenantId).Value;
            cashier.SetPermissions([
                .. PermsFor("pos.sessions",     "view"),
                .. PermsFor("pos.transactions", "view", "create", "print"),
                .. PermsFor("pos.products",     "view"),
            ]);
            db.Roles.Add(cashier);

            var supervisor = Role.Create("Supervisor",
                "Full POS operations — open/close shifts, void transactions, apply discounts, manage refunds.",
                isSystem: false, tenantId: tenantId).Value;
            supervisor.SetPermissions([
                .. PermsFor("pos.sessions",     "view", "create", "approve"),
                .. PermsFor("pos.transactions", "view", "create", "print", "void", "refund", "discount"),
                .. PermsFor("pos.products",     "view", "create", "edit"),
                .. PermsFor("pos.reports",      "view", "print"),
            ]);
            db.Roles.Add(supervisor);
        }

        return admin;
    }
}
