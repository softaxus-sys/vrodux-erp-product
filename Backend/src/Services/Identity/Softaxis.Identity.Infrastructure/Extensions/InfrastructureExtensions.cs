using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Infrastructure.Billing;
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
        services.AddScoped<ITeamRepository,         TeamRepository>();
        services.AddScoped<IUnitOfWork,             UnitOfWork>();

        // ── Services ──────────────────────────────────────────────────────────
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.AddSingleton<IJwtTokenService,       JwtTokenService>();
        services.AddSingleton<IPasswordHasher,         BcryptPasswordHasher>();
        services.AddSingleton<ITotpService,            TotpService>();
        services.AddSingleton<ITotpSecretProtector,    TotpSecretProtector>();
        services.AddSingleton<ITrialChallengeService,  TrialChallengeService>();
        services.AddScoped<ILicenseService,            LicenseService>();
        services.AddScoped<IEmailService,              SmtpEmailService>();
        services.AddScoped<ITenantRoleProvisioner,     TenantRoleProvisioner>();

        // ── Billing ───────────────────────────────────────────────────────────
        services.Configure<BillingOptions>(configuration.GetSection(BillingOptions.SectionName));

        // Super-admin-managed half of the billing config (enabled flags, price/plan ids, sandbox,
        // currency) overlaid on top of the environment. Registered as a post-configure so every
        // IOptionsSnapshot<BillingOptions> consumer picks it up without opting in — secrets are
        // untouched and still come only from env. Consumers MUST use IOptionsSnapshot, not
        // IOptions, or they would freeze the config at first resolution.
        services.AddScoped<IBillingSettingsStore, BillingSettingsStore>();
        services.AddSingleton<IPostConfigureOptions<BillingOptions>, BillingOptionsDbOverlay>();

        services.AddScoped<ISubscriptionRepository, SubscriptionRepository>();

        // Registered as a collection so handlers can pick by PaymentProvider and so the billing
        // page only advertises processors that actually have credentials configured.
        services.AddScoped<IBillingProvider, StripeBillingProvider>();
        services.AddScoped<IBillingProvider, PayPalBillingProvider>();
        services.AddHttpClient(PayPalBillingProvider.HttpClientName);

        // Lets billing drop the 60s access decision SubscriptionEnforcementMiddleware caches,
        // so a tenant that just paid stops being blocked immediately.
        services.AddSingleton<ISubscriptionAccessCache, MemoryCacheSubscriptionAccessCache>();

        // Daily trial reminders (15/7/3/1 days) + expiry. Self-throttling and fully guarded —
        // a failure logs and retries next cycle rather than taking the host down.
        services.AddHostedService<TrialLifecycleService>();

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

                // SignalR's browser client can't set an Authorization header on the WebSocket
                // handshake — it passes the token via ?access_token= instead. Only honoured for
                // hub paths, so REST endpoints still require a real Authorization header.
                opts.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                            context.Token = accessToken;
                        return Task.CompletedTask;
                    },
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
        var configuration  = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await db.Database.MigrateTolerantOfLockReleaseAsync();
        await SeedAdminAsync(db);
        await SeedSuperAdminAsync(db, passwordHasher, configuration);   // config-driven — no-op unless SuperAdmin creds are set

        // NOTE: the old SeedPOSRolesAsync seeded GLOBAL (tenant-less) operational roles
        // (Cashier / Supervisor / Store Manager / Inventory Manager / POS Admin) + demo users.
        // Those globals duplicated the per-tenant roles that TenantRoleProvisioner now creates, so
        // they showed up as duplicate role names in the super-admin list. They are no longer seeded
        // in ANY environment — every tenant gets its own distinct role set from the provisioner, and
        // RemoveRedundantGlobalRolesAsync below cleans up any that a previous build already created.

        await SyncAdministratorPermissionsAsync(db);       // always runs — idempotent
        await BackfillTenantRolesAsync(scope.ServiceProvider, db); // per-tenant roles + re-point admins
        // Module template roles (HR Manager, CRM Manager, …) top up ONLY with keys nobody holds
        // yet — i.e. keys seeded after those roles were created. Runs after the backfill so a
        // role created moments ago in this same pass is included.
        await scope.ServiceProvider.GetRequiredService<ITenantRoleProvisioner>()
                   .SyncNewTemplatePermissionsAsync();
        await RemoveRedundantGlobalRolesAsync(db);         // drop legacy global duplicates (all envs)
        await SeedDemoTenantAsync(scope.ServiceProvider, db);      // opt-in demo tenant (Seeding:DemoTenant)
    }

    /// <summary>
    /// Provisions a dedicated "Vrodux Demo" tenant (all modules) with default roles and a set of
    /// demo login users — for sales pitches / client demos. Opt-in via <c>Seeding:DemoTenant=true</c>
    /// and fully idempotent (skips once the demo tenant exists). Creates only NEW records — never
    /// touches any existing tenant's data. Business/sample data for the demo tenant is provisioned
    /// separately (the global seeders use fixed GUIDs and cannot be safely re-run per tenant).
    /// </summary>
    private static async Task SeedDemoTenantAsync(IServiceProvider sp, IdentityDbContext db)
    {
        var cfg = sp.GetService<IConfiguration>();
        if (!bool.TryParse(cfg?["Seeding:DemoTenant"], out var enabled) || !enabled) return;

        const string slug = "vrodux-demo";
        if (await db.Set<Identity.Domain.Entities.Tenant>().IgnoreQueryFilters().AnyAsync(t => t.Slug == slug))
            return; // already provisioned

        var logger          = sp.GetService<Microsoft.Extensions.Logging.ILoggerFactory>()?.CreateLogger("DemoTenantSeed");
        var tenantRepo      = sp.GetRequiredService<ITenantRepository>();
        var userRepo        = sp.GetRequiredService<IUserRepository>();
        var roleProvisioner = sp.GetRequiredService<ITenantRoleProvisioner>();
        var hasher          = sp.GetRequiredService<IPasswordHasher>();
        var uow             = sp.GetRequiredService<IUnitOfWork>();

        // Enable every module so the demo can show the whole product.
        string[] modules =
        [
            "crm", "sales", "purchase", "finance", "hr", "inventory", "pos",
            "project-management", "b2b", "education", "healthcare", "insurance",
            "reports", "settings",
        ];

        var tenant = Identity.Domain.Entities.Tenant.Create(
            name:           "Vrodux Demo",
            slug:           slug,
            plan:           Identity.Domain.Enums.PlanType.Enterprise,
            deploymentType: Identity.Domain.Enums.DeploymentType.Cloud,
            contactEmail:   "demo.admin@vrodux.com",
            country:        "United Arab Emirates",
            industry:       null,
            // Fixed id shared with every business service so their demo data (stamped via
            // DemoTenantSeeder) is scoped to this exact tenant.
            id:             Softaxis.BuildingBlocks.Infrastructure.Seeding.DemoTenantSeeder.DemoTenantId);
        tenant.SetEnabledModules(modules);
        tenant.SetCurrency("USD");
        tenant.Activate();
        tenantRepo.Add(tenant);

        // Administrator + one Manager role per module, then persist so we can look them up.
        var adminRole = await roleProvisioner.ProvisionAsync(tenant.Id, tenant.ResolvedModules);
        await uow.SaveChangesAsync();

        var tenantRoles = await db.Set<Identity.Domain.Entities.Role>()
            .IgnoreQueryFilters().Where(r => r.TenantId == tenant.Id).ToListAsync();

        const string demoPassword = "VroduxDemo@2026";
        var demoUsers = new[]
        {
            (Email: "demo.admin@vrodux.com",   Username: "demo.admin",   First: "Demo",   Last: "Admin",   Role: "Administrator"),
            (Email: "demo.sales@vrodux.com",   Username: "demo.sales",   First: "Sam",    Last: "Sales",   Role: "Sales Manager"),
            (Email: "demo.finance@vrodux.com", Username: "demo.finance", First: "Fatima", Last: "Finance", Role: "Finance Manager"),
            (Email: "demo.hr@vrodux.com",      Username: "demo.hr",      First: "Hina",   Last: "HR",      Role: "HR Manager"),
        };

        foreach (var u in demoUsers)
        {
            if (await userRepo.EmailExistsAsync(u.Email) || await userRepo.UsernameExistsAsync(u.Username))
                continue;

            var res = Identity.Domain.Entities.User.Create(u.Email, u.Username, u.First, u.Last, hasher.Hash(demoPassword));
            if (res.IsFailure) continue;

            var user = res.Value;
            user.VerifyEmail();
            user.SetTenant(tenant.Id);
            var role = tenantRoles.FirstOrDefault(r => r.Name == u.Role) ?? adminRole;
            user.AssignRole(role.Id);
            userRepo.Add(user);
        }

        await uow.SaveChangesAsync();

        logger?.LogWarning("──────── DEMO TENANT PROVISIONED (Vrodux Demo) ────────");
        foreach (var u in demoUsers)
            logger?.LogWarning("  {Role,-16} {Email}  /  {Password}", u.Role, u.Email, demoPassword);
        logger?.LogWarning("───────────────────────────────────────────────────────");
    }

    /// <summary>
    /// Removes legacy GLOBAL roles (TenantId == null) other than the single bootstrap Administrator.
    /// They duplicate the per-tenant roles created by <see cref="TenantRoleProvisioner"/> and are the
    /// source of the duplicate role names seen in the (unscoped) super-admin list. Any user still
    /// assigned a redundant global role is first re-pointed onto their tenant's same-named role, then
    /// the global role is deleted (its role_permissions / user_roles cascade). Idempotent + runs in
    /// every environment so the live DB is cleaned on the next startup too.
    /// </summary>
    private static async Task RemoveRedundantGlobalRolesAsync(IdentityDbContext db)
    {
        var redundant = await db.Set<Identity.Domain.Entities.Role>()
            .Include(r => r.RolePermissions)
            .Include(r => r.UserRoles)
            .Where(r => r.TenantId == null && r.Name != "Administrator")
            .ToListAsync();

        if (redundant.Count == 0) return;

        // (tenantId, roleName) → roleId, for re-pointing assigned users onto their own tenant's role.
        var tenantRoles = await db.Set<Identity.Domain.Entities.Role>()
            .Where(r => r.TenantId != null)
            .Select(r => new { r.Id, r.Name, r.TenantId })
            .ToListAsync();

        foreach (var role in redundant)
        {
            var userIds = role.UserRoles.Select(ur => ur.UserId).Distinct().ToList();
            if (userIds.Count > 0)
            {
                var users = await db.Users
                    .Include(u => u.UserRoles)
                    .Where(u => userIds.Contains(u.Id))
                    .ToListAsync();

                foreach (var u in users)
                {
                    var replacement = tenantRoles.FirstOrDefault(tr =>
                        tr.TenantId == u.TenantId &&
                        string.Equals(tr.Name, role.Name, StringComparison.OrdinalIgnoreCase));
                    if (replacement is not null) u.AssignRole(replacement.Id);
                    u.RemoveRole(role.Id);
                }
            }

            db.Set<Identity.Domain.Entities.Role>().Remove(role);
        }

        await db.SaveChangesAsync();
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
            IReadOnlyList<string> modules;
            try { modules = tenant.ResolvedModules; } catch { modules = []; }

            if (tenantAdmin is null)
            {
                tenantAdmin = await provisioner.ProvisionAsync(tenant.Id, modules);
                changed = true;
            }
            else if (await provisioner.EnsureModuleRolesAsync(tenant.Id, modules) > 0)
            {
                // Tenant predates a module or a role template — top up what's missing. Never
                // modifies or removes a role that already exists.
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
    /// Provisions the platform super-admin FROM CONFIGURATION — no credentials are hardcoded.
    /// Reads SuperAdmin:Email / SuperAdmin:Username / SuperAdmin:Password (env vars
    /// SuperAdmin__Email / SuperAdmin__Password, etc). If email or password is not configured,
    /// this is a complete no-op — it neither creates nor modifies any user, so an existing
    /// super admin in the DB is left exactly as-is and is NEVER overwritten on deploy/restart.
    /// When the configured user already exists, only the IsSuperAdmin flag is ensured; the
    /// password is never reset.
    /// </summary>
    private static async Task SeedSuperAdminAsync(IdentityDbContext db, IPasswordHasher hasher, IConfiguration cfg)
    {
        var email    = cfg["SuperAdmin:Email"]?.Trim();
        var username = cfg["SuperAdmin:Username"]?.Trim();
        var password = cfg["SuperAdmin:Password"];

        // No seed credentials configured → do nothing. Existing super admins are untouched.
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return;

        if (string.IsNullOrWhiteSpace(username))
            username = email;

        // Resolve the GLOBAL Administrator role (created in SeedAdminAsync). Must scope to
        // TenantId == null — per-tenant Administrator roles now also exist and a super-admin
        // must never be bootstrapped onto a specific tenant's role.
        var adminRole = db.Set<Identity.Domain.Entities.Role>()
                          .FirstOrDefault(r => r.Name == "Administrator" && r.TenantId == null);

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

    private static async Task SeedAdminAsync(IdentityDbContext db)
    {
        // Only bootstrap on a fresh DB.
        if (db.Users.Any()) return;

        // Ensure the GLOBAL Administrator role exists (assigned to the configured super-admin by
        // SeedSuperAdminAsync). No hardcoded bootstrap user is created any more — the super admin is
        // provisioned from configuration (SuperAdmin:Email / SuperAdmin:Password), never from source.
        if (db.Set<Identity.Domain.Entities.Role>().Any(r => r.Name == "Administrator" && r.TenantId == null))
            return;

        var allPermissionIds = db.Set<Identity.Domain.Entities.Permission>().Select(p => p.Id).ToList();

        var adminRole = Identity.Domain.Entities.Role.Create(
            "Administrator",
            "Full system access — all modules and operations.",
            isSystem: true).Value;

        adminRole.SetPermissions(allPermissionIds);
        db.Set<Identity.Domain.Entities.Role>().Add(adminRole);

        await db.SaveChangesAsync();
    }
}
