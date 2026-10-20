using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Calendar.Infrastructure.Persistence;

namespace Softaxis.Calendar.Infrastructure.Sync;

/// <summary>
/// Pulls each connected user's Google changes every few minutes, so something added in Google appears
/// here without anyone pressing a button. Same template as the other background jobs: a startup delay
/// (never compete with the awaited migrations that gate /health), a fresh scope and ambient tenant per
/// connection (cleared in a finally - it lives in an AsyncLocal), and a per-connection try/catch so one
/// bad account never stops the rest. Incremental sync makes an idle pass one tiny request per user.
/// </summary>
internal sealed class CalendarSyncBackgroundService(IServiceScopeFactory scopeFactory, ILogger<CalendarSyncBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan Interval     = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Calendar sync sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<(Guid TenantId, Guid ConnectionId)> due;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CalendarDbContext>();
            // No ambient tenant here, so the global filter would return nothing without IgnoreQueryFilters.
            var rows = await db.Connections.IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && c.Status == "connected")
                .Select(c => new { TenantId = EF.Property<Guid?>(c, "TenantId"), c.Id })
                .Where(x => x.TenantId != null)
                .ToListAsync(ct);
            due = rows.Select(x => (x.TenantId!.Value, x.Id)).ToList();
        }

        foreach (var (tenantId, connectionId) in due)
        {
            if (ct.IsCancellationRequested) return;
            using var scope = scopeFactory.CreateScope();
            try
            {
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                var db = scope.ServiceProvider.GetRequiredService<CalendarDbContext>();
                var sync = scope.ServiceProvider.GetRequiredService<GoogleCalendarSync>();
                var conn = await db.Connections.FirstOrDefaultAsync(c => c.Id == connectionId && !c.IsDeleted, ct);
                if (conn is null || conn.Status != "connected") continue;
                await sync.PullAsync(conn, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Calendar sync failed for connection {Connection} (tenant {Tenant}).", connectionId, tenantId);
            }
            finally { TenantAmbient.Clear(); }
        }
    }
}
