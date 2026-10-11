using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Emails customers about credit that is due or overdue, once a day per shop that has switched it on.
///
/// The startup delay is deliberate: every MigrateAndSeed* is awaited before the app serves, so work on
/// the boot path delays /health and can trip a deploy's health window into a rollback.
/// </summary>
internal sealed class CreditReminderBackgroundService(
    IServiceScopeFactory scopeFactory, ILogger<CreditReminderBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);
    /// <summary>Local hour from which the daily pass may run, so nobody is emailed in the middle of the night.</summary>
    private const int DailyHour = 9;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Credit reminder sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            // Without a mail account nothing can be delivered; skip quietly rather than log a failure per customer.
            if (!lookup.ServiceProvider.GetRequiredService<ICreditMailSender>().IsConfigured) return;

            // No ambient tenant here, so the tenant filter is bypassed on purpose and the shadow column read directly.
            var db = lookup.ServiceProvider.GetRequiredService<POSDbContext>();
            tenantIds = await db.CreditReminderSettings.IgnoreQueryFilters()
                .Where(s => s.Enabled)
                .Select(s => EF.Property<Guid?>(s, TenantIsolation.Column))
                .Where(id => id != null).Select(id => id!.Value).Distinct().ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;
            using var scope = scopeFactory.CreateScope();
            try
            {
                // A read-only cloud mirror of an on-premises shop must not email its customers a second time.
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                var db = scope.ServiceProvider.GetRequiredService<POSDbContext>();
                var currency = await db.Database.SqlQuery<string>(
                    $"SELECT TOP 1 [Currency] AS [Value] FROM [identity].[tenants] WHERE [Id] = {tenantId}").FirstOrDefaultAsync(ct);
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true, currency: string.IsNullOrWhiteSpace(currency) ? null : currency);

                var service = scope.ServiceProvider.GetRequiredService<CreditReminderService>();
                var settings = await service.GetOrCreateAsync(ct);
                if (!settings.Enabled) continue;

                var now = CreditReminderService.LocalNow(settings);
                var today = now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                if (settings.LastDailyRunOn == today || now.Hour < DailyHour) continue;

                var result = await service.RunAsync(dryRun: false, ct);
                settings.MarkDailyRun(today);
                await db.SaveChangesAsync(ct);

                if (result.DueSoon + result.Overdue + result.Failed > 0)
                    logger.LogInformation("Credit reminders {TenantId}: {DueSoon} due-soon, {Overdue} overdue, {Failed} failed.",
                        tenantId, result.DueSoon, result.Overdue, result.Failed);
            }
            catch (Exception ex) { logger.LogError(ex, "Credit reminder sweep failed for workspace {TenantId}.", tenantId); }
            finally { TenantAmbient.Clear(); }   // the ambient tenant is an AsyncLocal; left set it would leak into the next run
        }
    }
}
