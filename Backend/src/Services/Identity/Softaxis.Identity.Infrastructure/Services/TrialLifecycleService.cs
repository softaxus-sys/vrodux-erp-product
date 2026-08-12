using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Daily trial dunning + expiry.
///
/// <para>
/// Emails the tenant owner at <b>15 / 7 / 3 / 1</b> days remaining, then once more when the trial
/// actually lapses, and flips lapsed tenants to <see cref="TenantStatus.Expired"/>.
/// </para>
///
/// <para>
/// Expiry is belt-and-braces: <c>SubscriptionEnforcementMiddleware</c> already blocks a tenant whose
/// <c>TrialEndsAt</c> has passed even while the row still says <c>Trial</c>. Persisting the status
/// keeps reporting, the super-admin console and the JWT <c>subscription_state</c> claim honest rather
/// than relying on a computed check everywhere.
/// </para>
///
/// <para>
/// <b>Nothing is ever deleted.</b> Expiry gates access only; every tenant row and all its data stay
/// intact indefinitely, and paying restores access immediately.
/// </para>
/// </summary>
public sealed class TrialLifecycleService(
    IServiceProvider services,
    ILogger<TrialLifecycleService> logger) : BackgroundService
{
    /// <summary>Thresholds, descending. The largest threshold at or above the remaining days wins.</summary>
    private static readonly int[] ReminderDays = [15, 7, 3, 1];

    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    /// <summary>
    /// Deliberately delayed. Startup already runs migrations + seeding for every service, and the
    /// deploy health-check window is unforgiving — piling a tenant sweep onto boot risks a failed
    /// deploy. Nothing here is time-critical to the second.
    /// </summary>
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try { await Task.Delay(StartupDelay, ct); }
        catch (OperationCanceledException) { return; }

        while (!ct.IsCancellationRequested)
        {
            // Never let a bad run take the host down — a crashing BackgroundService can tear down
            // the whole app, which would turn a billing-email bug into an outage.
            try
            {
                await RunOnceAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Trial lifecycle sweep failed; will retry on the next cycle.");
            }

            try { await Task.Delay(Interval, ct); }
            catch (OperationCanceledException) { return; }
        }
    }

    internal async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db     = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var email  = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var access = scope.ServiceProvider.GetRequiredService<ISubscriptionAccessCache>();

        var now = DateTime.UtcNow;

        // Cloud trials only. On-prem tenants are governed by their signed license key, not by
        // TrialEndsAt, so sweeping them here would send meaningless email.
        var trials = await db.Tenants
            .Where(t => t.Status == TenantStatus.Trial
                     && t.DeploymentType == DeploymentType.Cloud
                     && t.TrialEndsAt != null)
            .ToListAsync(ct);

        var reminded = 0;
        var expired  = 0;

        foreach (var tenant in trials)
        {
            var daysLeft = (int)Math.Ceiling((tenant.TrialEndsAt!.Value - now).TotalDays);

            if (daysLeft > 0)
            {
                var threshold = ReminderDays.FirstOrDefault(d => daysLeft <= d);
                if (threshold == 0) continue;                          // still outside the 15-day window
                if (tenant.LastTrialReminderDaysLeft == threshold) continue;  // already sent for this step
                // Guard against re-sending a wider threshold if the clock ever moves backwards.
                if (tenant.LastTrialReminderDaysLeft is { } sent && sent < threshold) continue;

                if (await TrySendReminderAsync(db, email, tenant, threshold, ct))
                {
                    tenant.MarkTrialReminderSent(threshold);
                    reminded++;
                }
                continue;
            }

            // Trial has run out — gate access, keep every byte of data.
            tenant.Expire();
            access.Invalidate(tenant.Id);
            expired++;

            // 0 signals the "your trial has ended" variant; sentinel keeps it single-send.
            if (tenant.LastTrialReminderDaysLeft != 0
                && await TrySendReminderAsync(db, email, tenant, 0, ct))
            {
                tenant.MarkTrialReminderSent(0);
            }
        }

        if (reminded > 0 || expired > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation(
                "Trial lifecycle sweep: {Reminded} reminder(s) sent, {Expired} tenant(s) expired.",
                reminded, expired);
        }
    }

    /// <summary>
    /// Emails the tenant's owner. A send failure is logged and reported as <c>false</c> so the
    /// threshold is NOT marked sent — the next sweep retries rather than silently skipping a
    /// customer who never heard their trial was ending.
    /// </summary>
    private async Task<bool> TrySendReminderAsync(
        IdentityDbContext db, IEmailService email, Tenant tenant, int daysLeft, CancellationToken ct)
    {
        var recipient = await ResolveOwnerAsync(db, tenant, ct);
        if (recipient is null)
        {
            logger.LogWarning("No contactable owner for tenant {TenantId} ({Tenant}); skipping trial reminder.",
                tenant.Id, tenant.Name);
            return false;
        }

        try
        {
            await email.SendTrialReminderAsync(
                recipient.Value.Email, recipient.Value.Name, tenant.Name, daysLeft, tenant.Plan.ToString(), ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send trial reminder to {Email} for tenant {TenantId}.",
                recipient.Value.Email, tenant.Id);
            return false;
        }
    }

    /// <summary>
    /// Prefer the tenant's declared contact address; fall back to its earliest active user
    /// (in practice the admin created at signup).
    /// </summary>
    private static async Task<(string Email, string Name)?> ResolveOwnerAsync(
        IdentityDbContext db, Tenant tenant, CancellationToken ct)
    {
        // Project u.Email whole, not u.Email.Value: Email is mapped with a HasConversion value
        // converter (not an owned type), so dereferencing .Value inside the expression tree is
        // untranslatable and throws at query time. EF materialises the value object via the
        // converter, and .Value is then read in memory.
        var owner = await db.Users
            .Where(u => u.TenantId == tenant.Id && u.Status == UserStatus.Active)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new { u.Email, u.FirstName, u.LastName })
            .FirstOrDefaultAsync(ct);

        if (owner is not null)
            return (owner.Email.Value, $"{owner.FirstName} {owner.LastName}".Trim());

        return !string.IsNullOrWhiteSpace(tenant.ContactEmail)
            ? (tenant.ContactEmail!, tenant.Name)
            : null;
    }
}
