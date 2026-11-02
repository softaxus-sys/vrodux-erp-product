using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Handlers;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Services;

/// <summary>
/// Once a day, tells gym staff how many memberships end within the workspace's "expiring" window,
/// so the desk can call them before they lapse. Bell only. Off per workspace with the
/// "expiry alerts" setting; one alert per person per day; nothing on a day with nothing to report.
/// </summary>
internal sealed class FitnessAlertService(IServiceScopeFactory scopeFactory, ILogger<FitnessAlertService> logger) : BackgroundService
{
    // Never on the boot path: startup must stay quick or the deploy health check fails.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(8);
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Fitness alert sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            var db = lookup.ServiceProvider.GetRequiredService<FitnessDbContext>();
            // No ambient tenant here, so the global filter would return nothing.
            tenantIds = await db.Subscriptions.IgnoreQueryFilters()
                .Where(s => !s.IsDeleted && s.Status != SubscriptionStatus.Cancelled)
                .Select(s => EF.Property<Guid?>(s, "TenantId"))
                .Where(id => id != null).Distinct().Select(id => id!.Value)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;
            using var scope = scopeFactory.CreateScope();
            try
            {
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await RunForTenantAsync(scope.ServiceProvider, tenantId, ct);
            }
            catch (Exception ex) { logger.LogError(ex, "Fitness alerts failed for workspace {TenantId}.", tenantId); }
            finally { TenantAmbient.Clear(); }
        }
    }

    private static async Task RunForTenantAsync(IServiceProvider services, Guid tenantId, CancellationToken ct)
    {
        var db       = services.GetRequiredService<FitnessDbContext>();
        var settings = await Fx.SettingsAsync(db, ct);
        if (!settings.ExpiryAlertsEnabled) return;

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var state = await db.AlertStates.FirstOrDefaultAsync(ct);
        if (state?.LastSentOn == today) return;

        var until = DateTime.UtcNow.AddDays(settings.ExpiringWithinDays).ToString("yyyy-MM-dd");
        // A member's latest membership is the one that counts: someone who already renewed is not "expiring".
        var latest = await db.Subscriptions.AsNoTracking()
            .Where(s => !s.IsDeleted && s.Status != SubscriptionStatus.Cancelled)
            .GroupBy(s => s.MemberId).Select(g => g.Max(s => s.EndDate)).ToListAsync(ct);
        var expiring = latest.Count(e => string.CompareOrdinal(e, today) >= 0 && string.CompareOrdinal(e, until) <= 0);

        // Mark the day before sending: a crash in between must not produce a second alert.
        if (state is null) db.AlertStates.Add(new FitnessAlertState(today)); else state.Sent(today);
        await db.SaveChangesAsync(ct);
        if (expiring == 0) return;

        var to = await services.GetRequiredService<INotificationRecipients>().WithPermissionAsync(tenantId, "fitness.memberships.edit", ct);
        await services.GetRequiredService<INotificationDispatcher>().PublishManyAsync(to.Select(userId => new NotificationRequest(
            userId, NotificationModules.Fitness, NotificationEvents.FitnessExpiring,
            "Memberships ending soon",
            $"{expiring} {(expiring == 1 ? "membership ends" : "memberships end")} within {settings.ExpiringWithinDays} days.",
            Link: "/fitness/members", Type: "info", TenantId: tenantId)), ct);
    }
}
