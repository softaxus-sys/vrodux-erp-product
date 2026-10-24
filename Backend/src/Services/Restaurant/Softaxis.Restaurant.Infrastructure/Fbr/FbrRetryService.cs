using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Fbr;

/// <summary>Sends to FBR every paid bill it has not accepted yet — after an outage, a wrong token,
/// or a bill paid while the till was offline.</summary>
public sealed class FbrRetryService(IServiceScopeFactory scopes, ILogger<FbrRetryService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(3);
    /// <summary>After this many tries a bill waits for someone to press "Send again".</summary>
    internal const int MaxAutomaticAttempts = 50;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch (OperationCanceledException) { return; }
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogError(ex, "FBR retry pass failed."); }
            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        List<(Guid Id, Guid Tenant)> due;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
            var stale = DateTime.UtcNow - FbrReporter.SendingTimeout;
            var rows = await db.Orders.IgnoreQueryFilters()
                .Where(o => !o.IsDeleted && o.Status == "paid" && o.FbrAttempts < MaxAutomaticAttempts
                         && (o.FbrStatus == "pending" || o.FbrStatus == "failed"
                             || (o.FbrStatus == "sending" && o.UpdatedAt < stale)))
                .OrderBy(o => o.UpdatedAt).Take(200)
                .Select(o => new { o.Id, Tenant = EF.Property<Guid?>(o, TenantIsolation.Column) })
                .ToListAsync(ct);
            due = rows.Where(r => r.Tenant.HasValue).Select(r => (r.Id, r.Tenant!.Value)).ToList();
        }

        foreach (var group in due.GroupBy(d => d.Tenant))
        {
            using var scope = scopes.CreateScope();
            var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
            if (filter is not null && !await filter.ShouldProcessAsync(group.Key, ct)) continue;
            try
            {
                TenantAmbient.Set(group.Key, isSuperAdmin: false, isResolved: true);
                var reporter = scope.ServiceProvider.GetRequiredService<FbrReporter>();
                foreach (var (id, _) in group) await reporter.ReportAsync(id, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "FBR retry failed for workspace {Tenant}.", group.Key);
            }
            finally { TenantAmbient.Clear(); }
        }
    }
}
