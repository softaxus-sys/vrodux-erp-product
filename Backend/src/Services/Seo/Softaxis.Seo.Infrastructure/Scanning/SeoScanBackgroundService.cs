using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Seo.Infrastructure.Notifications;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Scanning;

/// <summary>
/// Runs any site whose <c>NextScanAt</c> has passed. Mirrors the established background-job template
/// used across this codebase (RentAlertBackgroundService, AiAutomationScheduler): startup delay so it
/// never competes with the awaited MigrateAndSeed*Async calls that gate /health, a fresh DI scope +
/// TenantAmbient.Set/Clear per tenant (never leak one tenant's ambient identity into the next), and a
/// swallow-and-log per-tenant try/catch so one workspace's bad data can never take the service down
/// for the process lifetime.
/// </summary>
internal sealed class SeoScanBackgroundService(IServiceScopeFactory scopeFactory, ILogger<SeoScanBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAllTenantsAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "SEO scan sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAllTenantsAsync(CancellationToken ct)
    {
        List<(Guid TenantId, Guid SiteId)> due;

        using (var lookupScope = scopeFactory.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<SeoDbContext>();
            // No ambient tenant here, so the global filter would return nothing without this.
            var rows = await db.Sites.IgnoreQueryFilters()
                .Where(s => !s.IsDeleted && s.Status == "active" && s.NextScanAt != null && s.NextScanAt <= DateTime.UtcNow)
                .Select(s => new { TenantId = EF.Property<Guid?>(s, "TenantId"), SiteId = s.Id })
                .Where(x => x.TenantId != null)
                .ToListAsync(ct);
            due = rows.Select(x => (TenantId: x.TenantId!.Value, x.SiteId)).ToList();
        }

        if (due.Count == 0) return;
        logger.LogInformation("SEO scan sweep: {Count} site(s) due.", due.Count);

        foreach (var (tenantId, siteId) in due)
        {
            if (ct.IsCancellationRequested) return;

            // A fresh scope per site: the DbContext is scoped, and reusing one across tenants would
            // carry the previous tenant's tracked entities into the next one's queries.
            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

                var db      = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
                var runner  = scope.ServiceProvider.GetRequiredService<ISiteScanRunner>();
                var notify  = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();

                var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == siteId, ct);
                if (site is null) continue;

                var scan = await runner.RunAsync(site, ct);
                if (scan.NoCredits)
                {
                    // Nothing was crawled or charged. Try again tomorrow rather than every hour, and tell the people who can top up.
                    site.ScheduleNextScan(DateTime.UtcNow.AddDays(1));
                    await db.SaveChangesAsync(ct);
                    logger.LogInformation("SEO scan skipped for site {Site}: no credits.", site.Id);
                    try
                    {
                        var recipients = await SeoNotificationRecipients.GetAsync(db, tenantId, ct);
                        await notify.PublishManyAsync(recipients.Select(userId => new NotificationRequest(
                            RecipientUserId: userId, Module: NotificationModules.Seo, Event: NotificationEvents.SeoCreditsOut,
                            Title: $"SEO audit skipped — no credits — {site.DisplayName}",
                            Message: "The scheduled audit did not run because this workspace has no SEO credits left.",
                            Link: $"/seo/sites/{site.Id}", Type: "warning", RelatedToType: "seo_site", RelatedToId: site.Id, TenantId: tenantId)), ct);
                    }
                    catch (Exception ex) { logger.LogWarning(ex, "SEO credits-out alert failed for site {Site}.", site.Id); }
                    continue;
                }
                logger.LogInformation("SEO scan completed for site {Site}: score {Score}, {Pages} page(s), {Issues} open issue(s), {Fixes} fix(es) proposed, {Credits} credit(s).",
                    site.Id, scan.Score, scan.PagesCrawled, scan.IssuesFound, scan.FixesProposed, scan.CreditsCharged);

                if (scan.FixesProposed > 0)
                {
                    try
                    {
                        var recipients = await SeoNotificationRecipients.GetAsync(db, tenantId, ct);
                        await notify.PublishManyAsync(recipients.Select(userId => new NotificationRequest(
                            RecipientUserId: userId,
                            Module:          NotificationModules.Seo,
                            Event:           NotificationEvents.SeoFixesReady,
                            Title:           $"{scan.FixesProposed} new SEO fix{(scan.FixesProposed == 1 ? "" : "es")} ready to review — {site.DisplayName}",
                            Message:         $"The scheduled audit scored {scan.Score}/100 with {scan.IssuesFound} open issue(s); the AI proposed {scan.FixesProposed} fix(es) for the new ones.",
                            Link:            $"/seo/sites/{site.Id}",
                            Type:            "info",
                            RelatedToType:   "seo_site",
                            RelatedToId:     site.Id,
                            TenantId:        tenantId)), ct);
                    }
                    catch (Exception ex) { logger.LogWarning(ex, "SEO scan alert failed for site {Site}.", site.Id); }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "SEO scan failed for site {Site} (tenant {TenantId}).", siteId, tenantId);
            }
            finally
            {
                // Must be cleared: the ambient tenant lives in an AsyncLocal, and leaving it set would
                // leak this workspace's identity into whatever runs next on this context.
                TenantAmbient.Clear();
            }
        }
    }
}
