using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>
/// Shared plumbing for the two workers: run something once per workspace, each in its own scope with
/// the right ambient tenant, one workspace's failure never stopping the others.
/// </summary>
internal static class WorkerSupport
{
    public static async Task ForEachTenantAsync(
        IServiceScopeFactory scopes, ILogger logger, IReadOnlyList<Guid> tenantIds, string what,
        Func<IServiceProvider, Guid, Task> work, CancellationToken ct)
    {
        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;
            using var scope = scopes.CreateScope();
            try
            {
                // A read-only cloud mirror of an on-premises workspace must not send or read mail twice.
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await work(scope.ServiceProvider, tenantId);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Lead generation {What} failed for workspace {TenantId}.", what, tenantId); }
            finally { TenantAmbient.Clear(); }   // AsyncLocal: would otherwise leak into whatever runs next
        }
    }
}

/// <summary>
/// Sends the emails that are due. Wakes every 45 seconds and sends only a couple per mailbox each
/// time, so a day's sending is spread out like a person's rather than fired in a burst — which is
/// both kinder to the recipients and what mail providers expect.
/// </summary>
internal sealed class OutreachSendWorker(IServiceScopeFactory scopes, ILogger<OutreachSendWorker> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(3);   // never on the boot path
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(45);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Outreach send sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenants;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
            var now = DateTime.UtcNow;
            // No ambient tenant here, so the filter passes every row; the tenant is read off each one.
            tenants = await db.Recipients.IgnoreQueryFilters().AsNoTracking()
                .Where(r => (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active) && r.NextSendAt != null && r.NextSendAt <= now)
                .Select(r => EF.Property<Guid?>(r, "TenantId")).Where(t => t != null).Distinct().Select(t => t!.Value).ToListAsync(ct);
        }
        if (tenants.Count == 0) return;

        await WorkerSupport.ForEachTenantAsync(scopes, logger, tenants, "sending",
            (sp, tenantId) => sp.GetRequiredService<IOutreachEngine>().SendDueAsync(tenantId, ct), ct);
    }
}

/// <summary>Reads every connected mailbox for replies and bounces, every couple of minutes.</summary>
internal sealed class MailboxSyncWorker(IServiceScopeFactory scopes, ILogger<MailboxSyncWorker> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(4);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Mailbox sync sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<(Guid Tenant, Guid Mailbox)> boxes;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LeadGenDbContext>();
            // Only mailboxes someone is actually waiting on: a connected one that has sent mail or belongs
            // to a live campaign. An idle mailbox with no outreach has nothing to match replies to.
            boxes = (await db.Mailboxes.IgnoreQueryFilters().AsNoTracking()
                .Where(m => !m.IsDeleted && m.Status == MailboxStatus.Connected && m.TotalSent > 0)
                .Select(m => new { m.Id, T = EF.Property<Guid?>(m, "TenantId") }).Where(x => x.T != null).ToListAsync(ct))
                .Select(x => (x.T!.Value, x.Id)).ToList();
        }

        foreach (var group in boxes.GroupBy(b => b.Tenant))
        {
            var ids = group.Select(g => g.Mailbox).ToList();
            await WorkerSupport.ForEachTenantAsync(scopes, logger, [group.Key], "mailbox sync", async (sp, _) =>
            {
                var engine = sp.GetRequiredService<IOutreachEngine>();
                foreach (var id in ids)
                {
                    try { await engine.SyncMailboxAsync(id, ct); }
                    catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogWarning(ex, "Mailbox {Id} sync failed.", id); }
                }
            }, ct);
        }
    }
}
