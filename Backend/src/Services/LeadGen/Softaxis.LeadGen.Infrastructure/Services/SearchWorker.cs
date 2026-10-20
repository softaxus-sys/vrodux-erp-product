using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>
/// Picks up queued searches and runs them, one at a time. Searches take seconds to minutes and call
/// a paid provider, so they never run inside a web request; the screen polls the job instead.
///
/// Single-instance by design: jobs left "running" by a crash are put back in the queue when the
/// process starts, which is only correct when one process owns the queue.
/// </summary>
internal sealed class SearchWorker(IServiceScopeFactory scopeFactory, ILogger<SearchWorker> logger) : BackgroundService
{
    // A short delay, unlike the daily sweeps: a user is waiting on these, but it must still stay off the
    // boot path so the deploy's health check is never held up.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(25);
    private static readonly TimeSpan Idle = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        await RequeueInterruptedAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var worked = false;
            try { worked = await RunNextAsync(stoppingToken); }
            catch (OperationCanceledException) { return; }
            catch (Exception ex) { logger.LogError(ex, "Lead search worker iteration failed."); }

            try { await Task.Delay(worked ? TimeSpan.FromMilliseconds(250) : Idle, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task RequeueInterruptedAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
            var n = await db.Searches.IgnoreQueryFilters().Where(s => s.Status == SearchStatus.Running)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SearchStatus.Queued), ct);
            if (n > 0) logger.LogInformation("Re-queued {Count} interrupted lead searches.", n);
        }
        catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogWarning(ex, "Could not re-queue interrupted searches."); }
    }

    private async Task<bool> RunNextAsync(CancellationToken ct)
    {
        Guid jobId; Guid? tenantId;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
            // No ambient tenant here, so the global filter passes every row; the tenant is read off the row.
            var next = await db.Searches.IgnoreQueryFilters().AsNoTracking()
                .Where(s => s.Status == SearchStatus.Queued && !s.IsDeleted)
                .OrderBy(s => s.CreatedAt)
                .Select(s => new { s.Id, TenantId = EF.Property<Guid?>(s, "TenantId") })
                .FirstOrDefaultAsync(ct);
            if (next is null) return false;
            jobId = next.Id; tenantId = next.TenantId;

            // Claim it. If another worker got there first, this matches nothing.
            var claimed = await db.Searches.IgnoreQueryFilters()
                .Where(s => s.Id == jobId && s.Status == SearchStatus.Queued)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SearchStatus.Running), ct);
            if (claimed == 0) return true;
        }

        using var runScope = scopeFactory.CreateScope();
        try
        {
            if (tenantId is not { } tid)
            {
                // A search with no workspace cannot be stored anywhere. Close it rather than loop on it.
                var db = runScope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
                await db.Searches.IgnoreQueryFilters().Where(s => s.Id == jobId)
                    .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SearchStatus.Failed).SetProperty(s => s.Error, "No workspace."), ct);
                return true;
            }

            var filter = runScope.ServiceProvider.GetService<ITenantWorkFilter>();
            if (filter is not null && !await filter.ShouldProcessAsync(tid, ct))
            {
                // A read-only mirror of an on-premises workspace never runs jobs; the shop does.
                var db = runScope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
                await db.Searches.IgnoreQueryFilters().Where(s => s.Id == jobId)
                    .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SearchStatus.Cancelled), ct);
                return true;
            }

            TenantAmbient.Set(tid, isSuperAdmin: false, isResolved: true);
            var runner = runScope.ServiceProvider.GetRequiredService<SearchRunner>();
            await runner.RunAsync(jobId, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lead search {Job} failed.", jobId);
            try
            {
                var db = runScope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
                db.ChangeTracker.Clear();
                await db.Searches.IgnoreQueryFilters().Where(s => s.Id == jobId && s.Status == SearchStatus.Running)
                    .ExecuteUpdateAsync(u => u
                        .SetProperty(s => s.Status, SearchStatus.Failed)
                        .SetProperty(s => s.Error, "Something went wrong while searching. Try again."), CancellationToken.None);
            }
            catch (Exception inner) { logger.LogError(inner, "Could not mark search {Job} as failed.", jobId); }
        }
        finally { TenantAmbient.Clear(); }
        return true;
    }
}
