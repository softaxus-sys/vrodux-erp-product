using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Persistence;

namespace Softaxis.Ecommerce.Infrastructure.Services;

/// <summary>
/// Keeps every connected store in step with Inventory: imports new orders, then pushes content and stock changes.
/// Runs every couple of minutes. A store that keeps failing is tried less and less often (up to once an hour) instead
/// of being hammered, and one workspace's trouble never stops the others.
/// </summary>
internal sealed class ChannelSyncWorker(IServiceScopeFactory scopeFactory, IConfiguration configuration, ILogger<ChannelSyncWorker> logger) : BackgroundService
{
    // Never on the boot path: startup must stay quick or the deploy health check fails. Configurable for tests only.
    private TimeSpan StartupDelay => TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue<int?>("Ecommerce:SyncStartupDelaySeconds") ?? 300));
    private TimeSpan Interval     => TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue<int?>("Ecommerce:SyncIntervalSeconds") ?? 120));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Store sync sweep failed."); }   // never end the service

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            var db = lookup.ServiceProvider.GetRequiredService<EcommerceDbContext>();
            // No ambient tenant here, so the global filter would return nothing.
            tenantIds = await db.Channels.IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && c.Status != ChannelStatuses.Paused)
                .Select(c => EF.Property<Guid?>(c, "TenantId"))
                .Where(id => id != null).Distinct().Select(id => id!.Value)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            using var scope = scopeFactory.CreateScope();
            try
            {
                // A read-only cloud mirror of an on-premises workspace must not push to the store a second time.
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await RunForTenantAsync(scope.ServiceProvider, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Store sync failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                TenantAmbient.Clear();   // AsyncLocal: would otherwise leak into whatever runs next
            }
        }
    }

    private async Task RunForTenantAsync(IServiceProvider services, CancellationToken ct)
    {
        var db   = services.GetRequiredService<EcommerceDbContext>();
        var sync = services.GetRequiredService<ChannelSyncService>();

        var channels = await db.Channels.Where(c => !c.IsDeleted && c.Status != ChannelStatuses.Paused).ToListAsync(ct);
        foreach (var ch in channels)
        {
            if (ct.IsCancellationRequested) return;
            if (!DueNow(ch)) continue;

            var result = await sync.SyncChannelAsync(ch, forceStockSet: false, ct);
            if (result.ProductsPushed + result.StockUpdates + result.OrdersImported + result.OrdersCancelled > 0)
                logger.LogInformation("Store {Store}: {Products} product(s), {Stock} stock update(s), {Orders} order(s) imported, {Cancelled} cancelled.",
                    ch.Name, result.ProductsPushed, result.StockUpdates, result.OrdersImported, result.OrdersCancelled);
        }
    }

    /// <summary>A failing store waits 2^n minutes (capped at an hour) after its n-th failure.</summary>
    internal static bool DueNow(SalesChannel ch)
    {
        if (ch.ConsecutiveFailures == 0 || ch.UpdatedAt is null) return true;
        var wait = TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, Math.Min(ch.ConsecutiveFailures, 6))));
        return DateTime.UtcNow - ch.UpdatedAt.Value >= wait;
    }
}
