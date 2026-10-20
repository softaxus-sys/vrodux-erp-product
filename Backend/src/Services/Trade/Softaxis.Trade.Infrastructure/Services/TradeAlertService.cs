using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Trade.Application.Dashboard;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Handlers.Dashboard;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Services;

/// <summary>
/// Once a day, tells the people who run shipments what needs attention: cargo past its expected
/// arrival, free days running out at the port, documents about to lapse — and, to the people who
/// handle the money, payments overdue and letters of credit about to expire.
///
/// One notification per person per kind per day, and nothing at all on a day with nothing to
/// report. It reads through <see cref="AttentionCalculator"/>, the same code the dashboard uses,
/// so the bell and the dashboard cannot disagree.
/// </summary>
internal sealed class TradeAlertService(
    IServiceScopeFactory scopeFactory,
    ILogger<TradeAlertService> logger) : BackgroundService
{
    // Never on the boot path: startup must stay quick or the deploy health check fails.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(7);
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            // An unhandled exception here would stop the service for the life of the process.
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Trade alert sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            var db = lookup.ServiceProvider.GetRequiredService<TradeDbContext>();

            // No ambient tenant here, so the global filter would return nothing. A workspace with
            // no shipment that is still moving has nothing to alert about.
            tenantIds = await db.Shipments.IgnoreQueryFilters()
                .Where(s => !s.IsDeleted && s.Status != ShipmentStatus.Closed && s.Status != ShipmentStatus.Cancelled)
                .Select(s => EF.Property<Guid?>(s, "TenantId"))
                .Where(id => id != null).Distinct().Select(id => id!.Value)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            using var scope = scopeFactory.CreateScope();
            try
            {
                // A read-only cloud mirror of an on-premises workspace must not alert twice.
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await RunForTenantAsync(scope.ServiceProvider, tenantId, ct);
            }
            catch (Exception ex)
            {
                // One workspace's bad data must not stop the others.
                logger.LogError(ex, "Trade alerts failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                TenantAmbient.Clear();   // AsyncLocal: would otherwise leak into whatever runs next
            }
        }
    }

    private static async Task RunForTenantAsync(IServiceProvider services, Guid tenantId, CancellationToken ct)
    {
        var db    = services.GetRequiredService<TradeDbContext>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var key   = today.ToString("yyyy-MM-dd");

        var state = await db.AlertStates.FirstOrDefaultAsync(ct);
        if (state?.LastDigestDate == key) return;   // already sent today

        var result = await AttentionCalculator.BuildAsync(db, today, includePayments: true, includeDocuments: true, ct);

        // Mark the day before sending: a crash in between must not produce a second digest.
        if (state is null) db.AlertStates.Add(new TradeAlertState(key));
        else state.Mark(key);
        await db.SaveChangesAsync(ct);

        int Count(params string[] kinds) => result.Items.Count(a => kinds.Contains(a.Kind));

        var shipments = new List<string>();
        Add(shipments, Count("delayed"), "shipment is past its expected arrival", "shipments are past their expected arrival");
        Add(shipments, Count("demurrage"), "shipment has used up its free days at the port", "shipments have used up their free days at the port");
        Add(shipments, Count("free_time"), "shipment is close to running out of free days", "shipments are close to running out of free days");
        Add(shipments, Count("document_expired"), "document has expired", "documents have expired");
        Add(shipments, Count("document_expiring"), "document expires within 30 days", "documents expire within 30 days");

        var money = new List<string>();
        Add(money, Count("payment_overdue"), "payment is overdue", "payments are overdue");
        Add(money, Count("payment_due"), "payment is due within 14 days", "payments are due within 14 days");
        Add(money, Count("lc_expired"), "letter of credit has expired", "letters of credit have expired");
        Add(money, Count("lc_expiring"), "letter of credit expires within 14 days", "letters of credit expire within 14 days");

        var recipients = services.GetRequiredService<INotificationRecipients>();
        var dispatcher = services.GetRequiredService<INotificationDispatcher>();
        var urgent = Count("delayed", "demurrage", "document_expired", "payment_overdue", "lc_expired") > 0;

        if (shipments.Count > 0)
        {
            var to = await recipients.WithPermissionAsync(tenantId, "trade.shipments.edit", ct);
            await dispatcher.PublishManyAsync(to.Select(userId => new NotificationRequest(
                userId, NotificationModules.Trade, NotificationEvents.TradeAttention,
                "Shipments need attention", string.Join("; ", shipments) + ".",
                Link: "/trade/dashboard", Type: urgent ? "warning" : "info", TenantId: tenantId)), ct);
        }

        if (money.Count > 0)
        {
            var to = await recipients.WithPermissionAsync(tenantId, "trade.payments.view", ct);
            await dispatcher.PublishManyAsync(to.Select(userId => new NotificationRequest(
                userId, NotificationModules.Trade, NotificationEvents.TradePaymentsAttention,
                "Shipment payments need attention", string.Join("; ", money) + ".",
                Link: "/trade/dashboard", Type: "warning", TenantId: tenantId)), ct);
        }
    }

    /// <summary>"1 shipment is…" / "3 shipments are…" — the sentence is built so it reads naturally either way.</summary>
    private static void Add(List<string> parts, int n, string one, string many)
    {
        if (n > 0) parts.Add($"{n} {(n == 1 ? one : many)}");
    }
}
