using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Domain.Entities;
using Softaxis.Manufacturing.Infrastructure.Persistence;

namespace Softaxis.Manufacturing.Infrastructure.Services;

/// <summary>
/// Once a day, tells the people who run production what needs attention: orders past their due
/// date and components open orders cannot be supplied with. One notification per person per day,
/// and nothing at all on a day with nothing to report.
/// </summary>
internal sealed class ProductionAlertService(
    IServiceScopeFactory scopeFactory,
    ILogger<ProductionAlertService> logger) : BackgroundService
{
    // Never on the boot path: startup must stay quick or the deploy health check fails.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(6);
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(6);

    private static readonly string[] OpenStatuses =
        [ProductionOrderStatus.Planned, ProductionOrderStatus.Released, ProductionOrderStatus.InProgress];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            // An unhandled exception here would stop the service for the life of the process.
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Production alert sweep failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        using (var lookup = scopeFactory.CreateScope())
        {
            var db = lookup.ServiceProvider.GetRequiredService<ManufacturingDbContext>();

            // No ambient tenant here, so the global filter would return nothing.
            tenantIds = await db.ProductionOrders.IgnoreQueryFilters()
                .Where(o => !o.IsDeleted && OpenStatuses.Contains(o.Status))
                .Select(o => EF.Property<Guid?>(o, "TenantId"))
                .Where(id => id != null).Distinct().Select(id => id!.Value)
                .ToListAsync(ct);
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await RunForTenantAsync(scope.ServiceProvider, tenantId, ct);
            }
            catch (Exception ex)
            {
                // One workspace's bad data must not stop the others.
                logger.LogError(ex, "Production alerts failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                TenantAmbient.Clear();   // AsyncLocal: would otherwise leak into whatever runs next
            }
        }
    }

    private static async Task RunForTenantAsync(IServiceProvider services, Guid tenantId, CancellationToken ct)
    {
        var db    = services.GetRequiredService<ManufacturingDbContext>();
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        var state = await db.AlertStates.FirstOrDefaultAsync(ct);
        if (state?.LastDigestDate == today) return;   // already sent today

        var open = await db.ProductionOrders.AsNoTracking()
            .Where(o => !o.IsDeleted && OpenStatuses.Contains(o.Status))
            .Select(o => new { o.Id, o.DueDate })
            .ToListAsync(ct);

        // Due dates are yyyy-MM-dd, so an ordinal compare is a date compare.
        var overdue = open.Count(o => o.DueDate is not null && string.CompareOrdinal(o.DueDate, today) < 0);

        var openIds = open.Select(o => o.Id).ToList();
        var needs = await db.ProductionOrderComponents.AsNoTracking()
            .Where(c => openIds.Contains(c.ProductionOrderId) && c.RequiredQuantity > c.IssuedQuantity)
            .GroupBy(c => c.ProductId)
            .Select(g => new { ProductId = g.Key, Required = g.Sum(c => c.RequiredQuantity - c.IssuedQuantity) })
            .ToListAsync(ct);

        var stock = services.GetRequiredService<IManufacturingStock>();
        var short_ = 0;
        foreach (var need in needs)
        {
            var item = await stock.GetItemAsync(need.ProductId, ct);
            if (item is null || item.StockQuantity < need.Required) short_++;
        }

        // Mark the day before sending: a crash in between must not produce a second digest.
        if (state is null) db.AlertStates.Add(new ManufacturingAlertState(today));
        else state.Mark(today);
        await db.SaveChangesAsync(ct);

        if (overdue == 0 && short_ == 0) return;

        var parts = new List<string>();
        if (overdue > 0) parts.Add(overdue == 1 ? "1 production order is overdue" : $"{overdue} production orders are overdue");
        if (short_ > 0)  parts.Add(short_ == 1 ? "1 component is short for open orders" : $"{short_} components are short for open orders");

        var recipients = await services.GetRequiredService<INotificationRecipients>()
            .WithPermissionAsync(tenantId, "manufacturing.orders.edit", ct);

        await services.GetRequiredService<INotificationDispatcher>().PublishManyAsync(
            recipients.Select(userId => new NotificationRequest(
                userId, NotificationModules.Manufacturing, NotificationEvents.ProductionAttention,
                "Production needs attention", string.Join(" and ", parts) + ".",
                Link: short_ > 0 ? "/manufacturing/planning" : "/manufacturing/orders",
                Type: "warning", TenantId: tenantId)), ct);
    }
}
