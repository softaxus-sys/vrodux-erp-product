using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Infrastructure.Sync;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Extensions;

/// <summary>
/// Adopts an EXISTING cloud tenant id on an on-premises installation, instead of creating a fresh
/// workspace with a fresh id.
///
/// <para>
/// A cloud mirror only works if both databases use the <b>same tenant GUID</b> - that is what makes
/// a pushed row identifiable on the other side. Every existing provisioning path
/// (<c>RegisterTrial</c>, <c>CreateTenant</c>) mints a new id, so an on-premises box set up the
/// normal way can never mirror anywhere. This closes that gap. See
/// <c>docs/on-premises-cloud-mirror.md</c> §3.4.
/// </para>
///
/// <para>
/// <b>The license key is the instruction.</b> It is RSA-signed and already carries the tenant id,
/// slug, plan, seat limit and expiry, so adoption needs no second source of truth and cannot be
/// pointed at a tenant the operator has no license for. Config supplies only what the signature
/// cannot: a display name, the module list, and optionally the first login.
/// </para>
///
/// <para>
/// Config-driven and a complete no-op unless <c>OnPremises:LicenseKey</c> is set, so cloud
/// deployments are untouched. Idempotent: on an installation that already holds the tenant it only
/// re-asserts deployment type, license and mirror flag, and never rewrites data.
/// </para>
/// </summary>
internal static class OnPremisesTenantAdoption
{
    public static async Task AdoptAsync(IServiceProvider sp, IdentityDbContext db)
    {
        var cfg     = sp.GetRequiredService<IConfiguration>();
        var logger  = sp.GetRequiredService<ILoggerFactory>().CreateLogger("OnPremisesTenantAdoption");
        var licence = cfg["OnPremises:LicenseKey"]?.Trim();

        // Nothing configured — this is a cloud deployment, or an on-prem box not yet licensed.
        if (string.IsNullOrWhiteSpace(licence))
            return;

        var payload = sp.GetRequiredService<ILicenseService>().ValidateLicenseKey(licence);
        if (payload is null)
        {
            // Never fabricate a tenant from an unverified key. A bad or expired license is an
            // operator problem to fix, and SubscriptionEnforcementMiddleware will block the
            // installation anyway — saying so here is what makes that block diagnosable.
            logger.LogError(
                "OnPremises: the configured license key is invalid or expired. No tenant was adopted; " +
                "the installation will be blocked until a valid key is supplied.");
            return;
        }

        var existing = await db.Tenants.IgnoreQueryFilters()
                               .FirstOrDefaultAsync(t => t.Id == payload.TenantId);

        if (existing is not null)
            await EnsureOnPremisesAsync(db, existing, licence, payload, logger);
        else
            await CreateAsync(sp, db, cfg, licence, payload, logger);

        await SeedSyncSettingsAsync(sp, cfg, payload.TenantId, logger);
    }

    /// <summary>
    /// Re-asserts the three facts that must hold on an on-premises box, and nothing else. Name,
    /// modules and users are the installation's own business once it exists.
    /// </summary>
    private static async Task EnsureOnPremisesAsync(
        IdentityDbContext db, Tenant tenant, string licence, LicensePayload payload, ILogger logger)
    {
        var changed = false;

        if (tenant.DeploymentType != DeploymentType.OnPremises)
        {
            tenant.SetDeploymentType(DeploymentType.OnPremises);
            changed = true;
        }

        // This box is the system of record. If it ever thought it was the mirror, every write would
        // be refused by SubscriptionEnforcementMiddleware and the shop could not trade.
        if (tenant.IsMirror)
        {
            tenant.SetMirror(false);
            changed = true;
            logger.LogWarning("OnPremises: workspace {TenantId} was flagged as a cloud mirror; cleared.", tenant.Id);
        }

        if (!string.Equals(tenant.LicenseKey, licence, StringComparison.Ordinal))
        {
            tenant.SetLicenseKey(licence, payload.ExpiresAt);
            changed = true;
            logger.LogInformation("OnPremises: license key updated for workspace {TenantId}.", tenant.Id);
        }

        if (changed) await db.SaveChangesAsync();
    }

    private static async Task CreateAsync(
        IServiceProvider sp, IdentityDbContext db, IConfiguration cfg,
        string licence, LicensePayload payload, ILogger logger)
    {
        var name = cfg["OnPremises:TenantName"]?.Trim();
        if (string.IsNullOrWhiteSpace(name)) name = payload.TenantSlug;

        var plan = Enum.TryParse<PlanType>(payload.Plan, ignoreCase: true, out var p) ? p : PlanType.Starter;

        // Tenant.Create takes an explicit id — the whole point of this path.
        var tenant = Tenant.Create(
            name:           name,
            slug:           payload.TenantSlug,
            plan:           plan,
            deploymentType: DeploymentType.OnPremises,
            contactEmail:   cfg["OnPremises:ContactEmail"]?.Trim(),
            country:        cfg["OnPremises:Country"]?.Trim(),
            industry:       cfg["OnPremises:Industry"]?.Trim(),
            id:             payload.TenantId);

        tenant.SetLicenseKey(licence, payload.ExpiresAt);
        tenant.Activate();

        var modules = SplitModules(cfg["OnPremises:Modules"]);
        if (modules.Count > 0) tenant.SetEnabledModules(modules);

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // ResolvedModules intersects the configured list with the plan's ceiling, so the roles
        // provisioned here match what the tenant can actually reach.
        var adminRole = await sp.GetRequiredService<ITenantRoleProvisioner>()
                                .ProvisionAsync(tenant.Id, tenant.ResolvedModules);

        await SeedFirstAdminAsync(sp, db, cfg, tenant, adminRole, logger);

        logger.LogInformation(
            "OnPremises: adopted workspace {TenantId} ({Name}, plan {Plan}) from the license key.",
            tenant.Id, tenant.Name, plan);
    }

    /// <summary>
    /// Creates the installation's first login, if credentials were configured. Optional on purpose:
    /// an installer may prefer to create the account by hand, and a box with no configured admin is
    /// a recoverable state, whereas a surprise account with a guessable password is not.
    /// </summary>
    private static async Task SeedFirstAdminAsync(
        IServiceProvider sp, IdentityDbContext db, IConfiguration cfg,
        Tenant tenant, Role adminRole, ILogger logger)
    {
        var email    = cfg["OnPremises:AdminEmail"]?.Trim();
        var password = cfg["OnPremises:AdminPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "OnPremises: no admin credentials configured for workspace {TenantId}. " +
                "Create the first user before the shop can sign in.", tenant.Id);
            return;
        }

        var username = cfg["OnPremises:AdminUsername"]?.Trim();
        if (string.IsNullOrWhiteSpace(username)) username = email;

        // Email uniqueness is global (IX_users_email has no TenantId) — a clash here means the
        // address already belongs to another login, so adopt nothing rather than fail the startup.
        var taken = db.Users.IgnoreQueryFilters().AsEnumerable()
                      .Any(u => u.Email.Value.Equals(email, StringComparison.OrdinalIgnoreCase));
        if (taken)
        {
            logger.LogWarning("OnPremises: {Email} is already registered; no admin user created.", email);
            return;
        }

        var hasher = sp.GetRequiredService<IPasswordHasher>();
        var result = User.Create(
            email, username,
            cfg["OnPremises:AdminFirstName"]?.Trim() ?? "Store",
            cfg["OnPremises:AdminLastName"]?.Trim()  ?? "Admin",
            hasher.Hash(password));

        if (result.IsFailure)
        {
            logger.LogError("OnPremises: could not create the admin user — {Error}.", result.Error.Description);
            return;
        }

        var user = result.Value;
        user.SetTenant(tenant.Id);
        // Pre-verified: there is no mail server on a shop counter, and an unverified account cannot
        // log in (LoginCommandHandler). The box would otherwise ship unusable.
        user.VerifyEmail();
        user.AssignRole(adminRole.Id);

        db.Users.Add(user);
        await db.SaveChangesAsync();

        logger.LogInformation("OnPremises: created the first administrator ({Email}).", email);
    }

    /// <summary>
    /// Seeds the nightly cloud-sync schedule from install-time configuration, so a site is fully
    /// provisioned in one step and the engineer never has to visit a screen to make the first push
    /// happen.
    ///
    /// <para>
    /// It only ever seeds. A time changed later on the Cloud Sync screen must survive a service
    /// restart - otherwise the screen would be decorative and every restart would silently revert
    /// the shop's schedule to whatever a config file said at install.
    /// </para>
    ///
    /// <para>Best-effort: a failure here never blocks a working installation from starting.</para>
    /// </summary>
    private static async Task SeedSyncSettingsAsync(
        IServiceProvider sp, IConfiguration cfg, Guid tenantId, ILogger logger)
    {
        var url = cfg["OnPremises:SyncCloudUrl"]?.Trim();
        if (string.IsNullOrWhiteSpace(url)) return;      // not configured to mirror

        try
        {
            var store   = sp.GetRequiredService<SyncSettingsStore>();
            var runAt   = cfg["OnPremises:SyncRunAtLocalTime"]?.Trim();
            var zone    = cfg["OnPremises:SyncTimeZoneId"]?.Trim();
            var enabled = !bool.TryParse(cfg["OnPremises:SyncEnabled"], out var e) || e;

            var seeded = await store.SeedIfAbsentAsync(
                tenantId,
                enabled,
                url,
                string.IsNullOrWhiteSpace(runAt) ? "23:30" : runAt,
                string.IsNullOrWhiteSpace(zone) ? "UTC" : zone);

            if (seeded)
                logger.LogInformation(
                    "OnPremises: cloud sync configured from install settings - {Url} at {Time} {Zone}.",
                    url, runAt ?? "23:30", zone ?? "UTC");
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "OnPremises: could not seed the cloud-sync schedule. The installation runs normally; " +
                "set it on the Cloud Sync screen instead.");
        }
    }

    private static List<string> SplitModules(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                 .Select(m => m.ToLowerInvariant())
                 .Distinct()
                 .ToList();
}
