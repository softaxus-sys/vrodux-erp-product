using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Domain.Entities;
using Softaxis.Ecommerce.Infrastructure.Handlers.Shop;
using Softaxis.Ecommerce.Infrastructure.Persistence;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shop;

/// <summary>
/// Gives stock back for card / PayPal orders nobody paid. An order that is waiting for payment holds its stock; if the
/// shopper walks away, this cancels it after its window and puts the goods back on the shelf. Stripe is asked first —
/// the shopper may have paid and the webhook been missed, and cancelling a paid order would be the worst outcome here.
/// </summary>
internal sealed class StoreOrderExpiryWorker(IServiceScopeFactory scopeFactory, IConfiguration configuration, ILogger<StoreOrderExpiryWorker> log) : BackgroundService
{
    // Never on the boot path: startup must stay quick or the deploy health check fails.
    private TimeSpan StartupDelay => TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue<int?>("Ecommerce:ExpiryStartupDelaySeconds") ?? 240));
    private TimeSpan Interval     => TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue<int?>("Ecommerce:ExpiryIntervalSeconds") ?? 300));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (Exception ex) { log.LogError(ex, "Store order expiry sweep failed."); }   // never end the service
            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        List<Guid> tenants;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<EcommerceDbContext>();
            var now = DateTime.UtcNow;
            // No ambient tenant here, so the global filter would return nothing.
            tenants = await db.StoreOrders.IgnoreQueryFilters()
                .Where(o => o.Status == StoreOrderStatuses.AwaitingPayment && o.ExpiresAt != null && o.ExpiresAt < now)
                .Select(o => EF.Property<Guid?>(o, "TenantId")).Where(id => id != null).Distinct().Select(id => id!.Value).ToListAsync(ct);
        }

        foreach (var tenantId in tenants)
        {
            if (ct.IsCancellationRequested) return;
            try { await SweepTenantAsync(tenantId, ct); }
            catch (Exception ex) { log.LogError(ex, "Expiring unpaid orders failed for workspace {Tenant}.", tenantId); }
            finally { TenantAmbient.Clear(); }
        }
    }

    private async Task SweepTenantAsync(Guid tenantId, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sp = scope.ServiceProvider;
        var filter = sp.GetService<ITenantWorkFilter>();
        if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) return;   // a cloud mirror must not cancel orders its primary is still working on

        var db = sp.GetRequiredService<EcommerceDbContext>();
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

        var store = await db.Stores.AsNoTracking().FirstOrDefaultAsync(ct);
        if (store is null) return;
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true, store.CurrencyCode);

        var orders = sp.GetRequiredService<StoreOrderService>();
        var stripe = sp.GetRequiredService<StripeGateway>();
        var protector = sp.GetRequiredService<ISecretProtector>();
        var key = store.StripeSecretEnc is null ? null : protector.Unprotect(store.StripeSecretEnc);

        var now = DateTime.UtcNow;
        var due = await db.StoreOrders.Include(o => o.Lines).Include(o => o.Events)
            .Where(o => o.Status == StoreOrderStatuses.AwaitingPayment && o.ExpiresAt != null && o.ExpiresAt < now).Take(100).ToListAsync(ct);

        foreach (var o in due)
        {
            if (o.PaymentMethod == PaymentMethods.Stripe && key is not null && !string.IsNullOrEmpty(o.StripeSessionId))
            {
                try { await StripeReconcile.ApplyAsync(stripe, key, store, o, orders, ct); }
                catch (PaymentException) { continue; }   // Stripe unreachable: leave it for the next pass rather than risk cancelling a paid order
                if (o.Status != StoreOrderStatuses.AwaitingPayment) continue;   // paid or cancelled by the reconcile
            }
            await orders.CancelAsync(store, o, "Not paid within the time allowed.", "System", ct);
        }
    }
}
