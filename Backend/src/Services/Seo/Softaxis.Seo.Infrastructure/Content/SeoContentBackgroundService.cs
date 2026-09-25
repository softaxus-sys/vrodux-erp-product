using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Notifications;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Content;

/// <summary>
/// Runs any site whose content settings are due — exact mirror of SeoScanBackgroundService's own
/// template (startup delay, per-tenant scope, TenantAmbient.Set/Clear, swallow-and-log per-site).
/// </summary>
internal sealed class SeoContentBackgroundService(IServiceScopeFactory scopeFactory, ILogger<SeoContentBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(7); // offset from the scan job's own 5-minute delay
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAllTenantsAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "SEO content sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAllTenantsAsync(CancellationToken ct)
    {
        List<(Guid TenantId, Guid SiteId, Guid SettingsId)> due;

        using (var lookupScope = scopeFactory.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<SeoDbContext>();
            var rows = await db.ContentSettings.IgnoreQueryFilters()
                .Where(cs => cs.Enabled && cs.NextRunAt != null && cs.NextRunAt <= DateTime.UtcNow)
                .Join(db.Sites.IgnoreQueryFilters().Where(s => !s.IsDeleted && s.Status == "active"),
                    cs => cs.SiteId, s => s.Id, (cs, s) => new { s, cs, TenantId = EF.Property<Guid?>(s, "TenantId") })
                .Where(x => x.TenantId != null)
                .Select(x => new { x.TenantId, SiteId = x.s.Id, SettingsId = x.cs.Id })
                .ToListAsync(ct);
            due = rows.Select(x => (TenantId: x.TenantId!.Value, x.SiteId, x.SettingsId)).ToList();
        }

        if (due.Count == 0) return;
        logger.LogInformation("SEO content sweep: {Count} site(s) due.", due.Count);

        foreach (var (tenantId, siteId, settingsId) in due)
        {
            if (ct.IsCancellationRequested) return;

            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

                var db      = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
                var runner  = scope.ServiceProvider.GetRequiredService<IArticleGenerationRunner>();
                var notify  = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();

                var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == siteId, ct);
                var settings = await db.ContentSettings.FirstOrDefaultAsync(cs => cs.Id == settingsId, ct);
                if (site is null || settings is null || !settings.Enabled) continue;

                var count = await runner.RunAsync(site, settings, ct);
                settings.RecordRunCompleted(DateTime.UtcNow);
                settings.ScheduleNextRun(ContentFrequencies.NextRun(settings.Frequency, DateTime.UtcNow));
                await db.SaveChangesAsync(ct);

                logger.LogInformation("SEO content run completed for site {Site}: {Count} article(s) drafted.", site.Id, count);

                if (count > 0)
                {
                    try
                    {
                        var recipients = await SeoNotificationRecipients.GetAsync(db, tenantId, "seo.content", "view", ct);
                        await notify.PublishManyAsync(recipients.Select(userId => new NotificationRequest(
                            RecipientUserId: userId,
                            Module:          NotificationModules.Seo,
                            Event:           NotificationEvents.SeoArticlesReady,
                            Title:           $"{count} new SEO article{(count == 1 ? "" : "s")} ready to review — {site.DisplayName}",
                            Message:         "The scheduled content run drafted new articles for review.",
                            Link:            $"/seo/sites/{site.Id}",
                            Type:            "info",
                            RelatedToType:   "seo_site",
                            RelatedToId:     site.Id,
                            TenantId:        tenantId)), ct);
                    }
                    catch (Exception ex) { logger.LogWarning(ex, "SEO content alert failed for site {Site}.", site.Id); }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "SEO content run failed for site {Site} (tenant {TenantId}).", siteId, tenantId);
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }
}
