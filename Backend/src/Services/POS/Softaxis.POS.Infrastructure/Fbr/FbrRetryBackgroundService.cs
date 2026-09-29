using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.POS.Application.Fbr;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Fbr;

/// <summary>
/// Sends sales that could not reach FBR at checkout (no internet, FBR down, token not yet set).
/// Runs every minute; each pending sale is retried on its own backoff schedule
/// (see POSTransaction.MarkFbrAttemptFailed) until FBR returns an invoice number.
///
/// Never on the startup path, never throws: one store's bad data must not stop another's
/// submissions, and an unhandled exception would stop the job for the life of the process.
/// </summary>
public sealed class FbrRetryBackgroundService(IServiceScopeFactory scopeFactory, ILogger<FbrRetryBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Interval     = TimeSpan.FromMinutes(1);
    private const int BatchSize = 50;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "FBR retry: sweep failed"); }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        // Stores that have FBR switched on. No ambient tenant here, so read past the filter.
        List<Guid?> tenantIds;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<POSDbContext>();
            tenantIds = await db.PosSettings.IgnoreQueryFilters()
                .Where(s => s.FbrEnabled)
                .Select(s => EF.Property<Guid?>(s, TenantIsolation.Column))
                .Where(t => t != null)
                .Distinct()
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                using var scope    = scopeFactory.CreateScope();
                var db             = scope.ServiceProvider.GetRequiredService<POSDbContext>();
                var reporter       = scope.ServiceProvider.GetRequiredService<FbrReporter>();

                var settings = await db.PosSettings.FirstOrDefaultAsync(ct);
                if (settings is null || !settings.FbrEnabled) continue;

                var now = DateTime.UtcNow;
                var due = await db.Transactions
                    .Include(t => t.LineItems)
                    .Include(t => t.Payments)
                    .Include(t => t.Customer)
                    .Where(t => t.FbrStatus == "pending" && (t.FbrNextAttemptAt == null || t.FbrNextAttemptAt <= now))
                    .OrderBy(t => t.CompletedAt)
                    .Take(BatchSize)
                    .ToListAsync(ct);

                if (due.Count == 0) continue;

                foreach (var txn in due)
                    await reporter.SubmitAsync(txn, settings, txn.Customer?.Name, ct);

                await db.SaveChangesAsync(ct);
                logger.LogInformation("FBR retry: tenant {Tenant} - {Sent} of {Due} submitted",
                    tenantId, due.Count(t => t.FbrStatus == "submitted"), due.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "FBR retry: tenant {Tenant} failed", tenantId);
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }
}
