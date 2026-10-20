using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Integrations;

/// <summary>
/// Collects new documents into the posting queue every 15 minutes, and posts them for
/// integrations set to automatic. Only workspaces that have switched an integration on are
/// touched — with none switched on anywhere, a pass is one query and nothing else.
/// </summary>
public sealed class PostingQueueHostedService(
    IServiceScopeFactory scopeFactory,
    ITenantWorkFilter workFilter,
    ILogger<PostingQueueHostedService> logger) : BackgroundService
{
    internal static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    // Every MigrateAndSeed* is awaited before the app serves, so work scheduled too early competes
    // with startup and delays /health.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAllTenantsAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unhandled exception here would end the service for the life of the process.
                logger.LogError(ex, "Posting queue: background pass failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private sealed record TenantCurrencyRow(Guid Id, string? Currency);

    private async Task RunAllTenantsAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        var currencies = new Dictionary<Guid, string?>();

        using (var lookupScope = scopeFactory.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<FinanceDbContext>();

            // No ambient tenant here, so the filter has to be lifted to see across workspaces.
            tenantIds = (await db.IntegrationSettings
                    .IgnoreQueryFilters()
                    .Where(s => s.Mode != IntegrationSetting.Off)
                    .Select(s => EF.Property<Guid?>(s, "TenantId"))
                    .Where(id => id != null)
                    .Distinct()
                    .ToListAsync(ct))
                .Select(id => id!.Value)
                .ToList();

            if (tenantIds.Count == 0) return;

            // The ledger is kept in each workspace's own currency; without it on the ambient
            // context every amount would be treated as the platform default.
            // "identity" is a reserved SQL Server keyword and must stay bracketed.
            var rows = await db.Database
                .SqlQuery<TenantCurrencyRow>($"SELECT [Id], [Currency] FROM [identity].[tenants]")
                .ToListAsync(ct);
            foreach (var r in rows) currencies[r.Id] = r.Currency;
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            // A read-only cloud mirror must not post: the on-premises site already does.
            if (!await workFilter.ShouldProcessAsync(tenantId, ct))
                continue;

            // The ledger currency would otherwise fall back to a platform default, and documents
            // would be posted under a currency the workspace never chose.
            var currency = currencies.GetValueOrDefault(tenantId);
            if (string.IsNullOrWhiteSpace(currency) || currency.Trim().Length != 3)
            {
                logger.LogWarning("Posting queue: workspace {TenantId} has no currency set; nothing was collected or posted for it.", tenantId);
                continue;
            }

            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true,
                    currency: currency.Trim().ToUpperInvariant());

                var engine   = scope.ServiceProvider.GetRequiredService<PostingEngine>();
                var outcomes = await engine.SyncAsync(null, null, ct);

                foreach (var o in outcomes.Where(o => o.Collected > 0 || o.Posted > 0 || o.Failed > 0 || o.Error is not null))
                    logger.LogInformation(
                        "Posting queue: workspace {TenantId} {Key} — {Collected} collected, {Posted} posted, {Failed} failed. {Error}",
                        tenantId, o.IntegrationKey, o.Collected, o.Posted, o.Failed, o.Error);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Posting queue: pass failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                // An AsyncLocal: left set, it would leak into whatever runs next on this thread.
                TenantAmbient.Clear();
            }
        }
    }
}
