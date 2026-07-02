using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Infrastructure.Persistence;
using Softaxis.Identity.Infrastructure.Persistence.Repositories;
using Softaxis.Identity.Infrastructure.Services;

namespace Softaxis.Identity.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── Database ──────────────────────────────────────────────────────────
        services.AddDbContext<IdentityDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("IdentityDb"),
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "identity")
            ));

        // ── Repositories ──────────────────────────────────────────────────────
        services.AddScoped<IUserRepository,         UserRepository>();
        services.AddScoped<IRoleRepository,         RoleRepository>();
        services.AddScoped<IPermissionRepository,   PermissionRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IAuditLogRepository,     AuditLogRepository>();
        services.AddScoped<IAppSettingRepository,   AppSettingRepository>();
        services.AddScoped<IBranchRepository,       BranchRepository>();
        services.AddScoped<ITenantRepository,       TenantRepository>();
        services.AddScoped<IUnitOfWork,             UnitOfWork>();

        // ── Services ──────────────────────────────────────────────────────────
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.AddSingleton<IJwtTokenService,       JwtTokenService>();
        services.AddSingleton<IPasswordHasher,         BcryptPasswordHasher>();
        services.AddSingleton<ITrialChallengeService,  TrialChallengeService>();
        services.AddScoped<ILicenseService,            LicenseService>();
        services.AddScoped<IEmailService,              SmtpEmailService>();
        services.AddScoped<ITenantRoleProvisioner,     TenantRoleProvisioner>();

        // ── Tenant context (scoped — reset per request) ───────────────────────
        services.AddScoped<TenantContextService>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContextService>());

        // ── JWT Auth ──────────────────────────────────────────────────────────
        var jwtSettings = configuration.GetSection("Jwt").Get<JwtSettings>()!;

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opts =>
            {
                opts.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer           = true,
                    ValidateAudience         = true,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer              = jwtSettings.Issuer,
                    ValidAudience            = jwtSettings.Audience,
                    IssuerSigningKey         = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtSettings.Secret)),
                    ClockSkew                = TimeSpan.FromSeconds(30),
                };
            });

        // ── Authorization policies ────────────────────────────────────────────
        services.AddAuthorization(opts =>
        {
            opts.AddPolicy("SuperAdminOnly", policy =>
                policy.RequireAuthenticatedUser()
                      .RequireClaim("is_super_admin", "true"));
        });

        return services;
    }

    public static async Task MigrateAndSeedAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db             = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        await db.Database.MigrateAsync();
        await SeedAdminAsync(db, passwordHasher);
        await SeedSuperAdminAsync(db, passwordHasher);   // always runs — idempotent
        await SeedPOSRolesAsync(db, passwordHasher);
        await SyncAdministratorPermissionsAsync(db);     // always runs — idempotent
        await BackfillTenantRolesAsync(scope.ServiceProvider, db); // per-tenant roles + re-point admins
    }

    /// <summary>
    /// Gives every existing tenant its own role set (Administrator + per-module Managers) and
    /// re-points users who still hold the legacy GLOBAL Administrator onto their tenant's own
    /// Administrator. Idempotent + non-destructive: it never removes a user's access (the new
    /// Administrator carries the same full permission set) and never deletes legacy roles —
    /// those simply stop appearing in any tenant's list once role queries are tenant-scoped.
    /// </summary>
    private static async Task BackfillTenantRolesAsync(IServiceProvider sp, IdentityDbContext db)
    {
        var tenants = await db.Set<Identity.Domain.Entities.Tenant>().ToListAsync();
        if (tenants.Count == 0) return;

        var provisioner = sp.GetRequiredService<ITenantRoleProvisioner>();

        // Legacy global Administrator role(s): TenantId == null (pre-per-tenant).
        var globalAdminIds = await db.Set<Identity.Domain.Entities.Role>()
            .Where(r => r.TenantId == null && r.Name == "Administrator")
            .Select(r => r.Id)
            .ToListAsync();
        var globalAdminSet = globalAdminIds.ToHashSet();

        var changed = false;
        foreach (var tenant in tenants)
        {
            // 1) Ensure this tenant owns an Administrator (and per-module Managers).
            var tenantAdmin = await db.Set<Identity.Domain.Entities.Role>()
                .FirstOrDefaultAsync(r => r.TenantId == tenant.Id && r.Name == "Administrator");
            if (tenantAdmin is null)
            {
                IReadOnlyList<string> modules;
                try { modules = tenant.ResolvedModules; } catch { modules = []; }
                tenantAdmin = await provisioner.ProvisionAsync(tenant.Id, modules);
                changed = true;
            }

            // 2) Re-point this tenant's users off any legacy global Administrator onto their own.
            if (globalAdminSet.Count > 0)
            {
                var users = await db.Users
                    .Include(u => u.UserRoles)
                    .Where(u => u.TenantId == tenant.Id)
                    .ToListAsync();

                foreach (var u in users)
                {
                    if (!u.UserRoles.Any(ur => globalAdminSet.Contains(ur.RoleId))) continue;
                    u.AssignRole(tenantAdmin.Id);
                    foreach (var gid in globalAdminIds) u.RemoveRole(gid);
                    changed = true;
                }
            }
        }

        if (changed) await db.SaveChangesAsync();
    }

    /// <summary>
    /// Ensures every system "Administrator" role has all currently-seeded permissions.
    /// New permissions added to <see cref="Softaxis.Identity.Application.Seed.PermissionSeedData"/>
    /// land here automatically on existing tenants — runs every startup, fully idempotent.
    /// </summary>
    private static async Task SyncAdministratorPermissionsAsync(IdentityDbContext db)
    {
        var allPermissionIds = db.Set<Identity.Domain.Entities.Permission>().Select(p => p.Id).ToList();
        var adminRoles = db.Set<Identity.Domain.Entities.Role>()
            .Include(r => r.RolePermissions)
            .Where(r => r.IsSystem && r.Name == "Administrator")
            .ToList();

        var changed = false;
        foreach (var role in adminRoles)
        {
            var existing = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();
            foreach (var id in allPermissionIds.Where(id => !existing.Contains(id)))
            {
                role.AddPermission(id);
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync();
    }

    /// <summary>
    /// Ensures superadmin@softaxis.io exists and has IsSuperAdmin = true.
    /// Runs every startup — fully idempotent. Creates the user if absent,
    /// patches IsSuperAdmin if the row exists but the flag is not set yet.
    /// </summary>
    private static async Task SeedSuperAdminAsync(IdentityDbContext db, IPasswordHasher hasher)
    {
        const string email    = "softaxus@gmail.com";
        const string username = "superadmin";
        const string password = "SuperAdmin@2025!";

        // Resolve admin role (created in SeedAdminAsync)
        var adminRole = db.Set<Identity.Domain.Entities.Role>()
                          .FirstOrDefault(r => r.Name == "Administrator");

        // Evaluate client-side because Email is a value-object with a converter
        var existing = db.Users.IgnoreQueryFilters()
                         .AsEnumerable()
                         .FirstOrDefault(u => u.Email.Value.Equals(email, StringComparison.OrdinalIgnoreCase));

        if (existing is not null)
        {
            // Already exists — ensure flag is set (covers the upgrade case)
            if (!existing.IsSuperAdmin)
            {
                existing.MakeSuperAdmin();
                db.Users.Update(existing);
                await db.SaveChangesAsync();
            }
            return;
        }

        // Create fresh super-admin user
        var result = Identity.Domain.Entities.User.Create(
            email, username, "Super", "Admin", hasher.Hash(password));

        if (result.IsFailure) return;

        var user = result.Value;
        user.VerifyEmail();
        user.MakeSuperAdmin();

        if (adminRole is not null)
            user.AssignRole(adminRole.Id);

        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    private static async Task SeedAdminAsync(IdentityDbContext db, IPasswordHasher hasher)
    {
        // Skip if any user already exists
        if (db.Users.Any()) return;

        var allPermissions    = db.Set<Identity.Domain.Entities.Permission>().ToList();
        var allPermissionIds  = allPermissions.Select(p => p.Id).ToList();

        // ── Create Administrator role ─────────────────────────────────────────
        var adminRole = Identity.Domain.Entities.Role.Create(
            "Administrator",
            "Full system access — all modules and operations.",
            isSystem: true).Value;

        adminRole.SetPermissions(allPermissionIds);
        db.Set<Identity.Domain.Entities.Role>().Add(adminRole);

        // ── Create default admin user ─────────────────────────────────────────
        const string adminEmail    = "admin@softaxis.io";
        const string adminUsername = "admin";
        const string adminPassword = "Admin@123456";

        var adminUserResult = Identity.Domain.Entities.User.Create(
            adminEmail,
            adminUsername,
            "Admin",
            "User",
            hasher.Hash(adminPassword));

        if (adminUserResult.IsFailure) return;

        var adminUser = adminUserResult.Value;
        adminUser.VerifyEmail();      // sets Status = Active + EmailVerified = true
        adminUser.MakeSuperAdmin();   // marks as super-admin, clears TenantId
        adminUser.AssignRole(adminRole.Id);

        db.Users.Add(adminUser);

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds POS-specific roles (Cashier, Supervisor, Store Manager, Inventory Manager, POS Admin)
    /// and one demo user per role. Safe to call on existing installs — skips if roles already exist.
    /// </summary>
    private static async Task SeedPOSRolesAsync(IdentityDbContext db, IPasswordHasher hasher)
    {
        // Skip if POS roles already seeded
        if (db.Set<Identity.Domain.Entities.Role>().Any(r => r.Name == "Cashier")) return;

        var allPerms = db.Set<Identity.Domain.Entities.Permission>().ToList();

        // Helper: get IDs for a given module + actions
        Guid[] PermsFor(string moduleId, params string[] actions) =>
            [.. allPerms
                .Where(p => p.ModuleId == moduleId && actions.Contains(p.Action))
                .Select(p => p.Id)];

        // ── Cashier ───────────────────────────────────────────────────────────
        // Sell products, view history, print receipts. No voids/refunds/discounts.
        var cashierRole = Identity.Domain.Entities.Role.Create(
            "Cashier",
            "Process sales at the POS terminal. View products and print receipts.",
            isSystem: true).Value;
        cashierRole.SetPermissions([
            .. PermsFor("pos.sessions",     "view"),
            .. PermsFor("pos.transactions", "view", "create", "print"),
            .. PermsFor("pos.products",     "view"),
        ]);
        db.Set<Identity.Domain.Entities.Role>().Add(cashierRole);

        // ── Supervisor ────────────────────────────────────────────────────────
        // Full POS operations: open/close shifts, void/refund/discount transactions,
        // add new products to catalogue.
        var supervisorRole = Identity.Domain.Entities.Role.Create(
            "Supervisor",
            "Full POS operations — open/close shifts, void transactions, apply discounts, manage refunds.",
            isSystem: true).Value;
        supervisorRole.SetPermissions([
            .. PermsFor("pos.sessions",     "view", "create", "approve"),
            .. PermsFor("pos.transactions", "view", "create", "print", "void", "refund", "discount"),
            .. PermsFor("pos.products",     "view", "create", "edit"),
            .. PermsFor("pos.reports",      "view", "print"),
        ]);
        db.Set<Identity.Domain.Entities.Role>().Add(supervisorRole);

        // ── Store Manager ─────────────────────────────────────────────────────
        // All POS + stock management (adjust, movements, transfers). Can delete products.
        var storeManagerRole = Identity.Domain.Entities.Role.Create(
            "Store Manager",
            "Full POS access plus inventory stock, movements, and transfer management.",
            isSystem: true).Value;
        storeManagerRole.SetPermissions([
            .. PermsFor("pos.sessions",        "view", "create", "approve"),
            .. PermsFor("pos.transactions",    "view", "create", "print", "void", "refund", "discount"),
            .. PermsFor("pos.products",        "view", "create", "edit", "delete"),
            .. PermsFor("pos.reports",         "view", "export", "print"),
            .. PermsFor("inventory.stock",     "view", "create", "edit", "adjust"),
            .. PermsFor("inventory.movements", "view", "create", "export"),
            .. PermsFor("inventory.transfers", "view", "create", "approve"),
        ]);
        db.Set<Identity.Domain.Entities.Role>().Add(storeManagerRole);

        // ── Inventory Manager ─────────────────────────────────────────────────
        // Full stock/warehouse/movement/transfer control + product catalogue management.
        var inventoryManagerRole = Identity.Domain.Entities.Role.Create(
            "Inventory Manager",
            "Full inventory control — stock, warehouses, movements, transfers, and POS product catalogue.",
            isSystem: true).Value;
        inventoryManagerRole.SetPermissions([
            .. PermsFor("inventory.stock",      "view", "create", "edit", "delete", "export", "adjust"),
            .. PermsFor("inventory.warehouses", "view", "create", "edit", "delete"),
            .. PermsFor("inventory.movements",  "view", "create", "export", "adjust"),
            .. PermsFor("inventory.transfers",  "view", "create", "approve", "export"),
            .. PermsFor("pos.products",         "view", "create", "edit", "delete"),
            .. PermsFor("pos.reports",          "view", "export"),
        ]);
        db.Set<Identity.Domain.Entities.Role>().Add(inventoryManagerRole);

        // ── POS Admin ─────────────────────────────────────────────────────────
        // All POS + inventory permissions + read-only settings access.
        var posAdminRole = Identity.Domain.Entities.Role.Create(
            "POS Admin",
            "Full POS and inventory administration, including reports and settings visibility.",
            isSystem: true).Value;
        posAdminRole.SetPermissions([
            .. allPerms
                .Where(p => p.ModuleId.StartsWith("pos.") || p.ModuleId.StartsWith("inventory."))
                .Select(p => p.Id),
            .. PermsFor("settings.users",    "view"),
            .. PermsFor("settings.roles",    "view"),
            .. PermsFor("settings.branches", "view"),
        ]);
        db.Set<Identity.Domain.Entities.Role>().Add(posAdminRole);

        await db.SaveChangesAsync();

        // ── Demo users (one per POS role) ─────────────────────────────────────
        const string demoPassword = "Demo@123456";

        var demoUsers = new[]
        {
            (cashierRole.Id,          "cashier@softaxis.io",      "cashier",      "Sara",   "Khan"),
            (supervisorRole.Id,       "supervisor@softaxis.io",   "supervisor",   "Ahmed",  "Ali"),
            (storeManagerRole.Id,     "storemanager@softaxis.io", "storemanager", "Fatima", "Malik"),
            (inventoryManagerRole.Id, "invmanager@softaxis.io",   "invmanager",   "Usman",  "Raza"),
            (posAdminRole.Id,         "posadmin@softaxis.io",     "posadmin",     "Zainab", "Sheikh"),
        };

        // Email is a value-object with a string converter — evaluate client-side to extract .Value
        var existingEmails = db.Users.IgnoreQueryFilters()
            .AsEnumerable()
            .Select(u => u.Email.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var (roleId, email, username, first, last) in demoUsers)
        {
            if (existingEmails.Contains(email)) continue;
            var result = Identity.Domain.Entities.User.Create(email, username, first, last, hasher.Hash(demoPassword));
            if (result.IsFailure) continue;
            var u = result.Value;
            u.VerifyEmail();
            u.AssignRole(roleId);
            db.Users.Add(u);
        }

        await db.SaveChangesAsync();
    }
}
