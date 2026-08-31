using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Services;

/// <summary>
/// Runs the reminder sweep once a day for every workspace that has leases.
///
/// Startup delay is deliberate and matches TrialLifecycleService: every MigrateAndSeed* runs
/// awaited before app.RunAsync(), so anything heavy on the boot path delays /health and can trip
/// the deploy's health window into a rollback. This waits until the app is already serving.
/// </summary>
internal sealed class RentAlertBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<RentAlertBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            // One workspace's bad data must never stop every other workspace's rent reminders,
            // and an unhandled exception here would kill the service for the process lifetime.
            try { await SweepAllTenantsAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Rent alert sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAllTenantsAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;

        using (var lookupScope = scopeFactory.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<RealEstateDbContext>();

            // No ambient tenant here, so the global filter would return nothing: IgnoreQueryFilters
            // is required to see across workspaces, and the shadow column has to be read via
            // EF.Property because it is not on the entity.
            tenantIds = await db.LeaseContracts
                .IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && c.Status == "active")
                .Select(c => EF.Property<Guid?>(c, "OwnerTenantId"))
                .Where(id => id != null)
                .Distinct()
                .Select(id => id!.Value)
                .ToListAsync(ct);
        }

        if (tenantIds.Count == 0) return;

        logger.LogInformation("Rent alert sweep starting for {Count} workspace(s).", tenantIds.Count);

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            // A fresh scope per workspace: the DbContext is scoped, and reusing one across tenants
            // would carry the previous tenant's tracked entities into the next one's queries.
            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

                var sender = scope.ServiceProvider.GetRequiredService<IRentAlertSender>();
                var result = await sender.RunForCurrentTenantAsync(dryRun: false, ct);

                if (result.DueRemindersSent + result.OverdueRemindersSent + result.ExpiryRemindersSent + result.Failed > 0)
                    logger.LogInformation(
                        "Workspace {TenantId}: {Due} due, {Overdue} overdue, {Expiry} expiry, {Failed} failed.",
                        tenantId, result.DueRemindersSent, result.OverdueRemindersSent,
                        result.ExpiryRemindersSent, result.Failed);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Rent alert sweep failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                // Must be cleared: the ambient tenant lives in an AsyncLocal, and leaving it set
                // would leak this workspace's identity into whatever runs next on this context.
                TenantAmbient.Clear();
            }
        }
    }
}
