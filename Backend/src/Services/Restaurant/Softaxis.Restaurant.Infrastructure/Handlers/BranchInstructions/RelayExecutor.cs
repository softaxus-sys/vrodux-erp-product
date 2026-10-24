using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.PublicOrdering.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Handlers.Platforms;
using Softaxis.Restaurant.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Platforms;

namespace Softaxis.Restaurant.Infrastructure.Handlers.BranchInstructions;

/// <summary>
/// Runs on a BRANCH server. (1) Creates the bills for orders the cloud relayed here - QR / kiosk and
/// Foodpanda - and applies Foodpanda cancellations; (2) applies the cloud's answer to an accept / reject
/// asked at this till. Each outcome is recorded in a row that syncs back up.
///
/// <para>
/// Replaying is safe: a relayed order keeps the cloud's id, so if a bill already exists with that id the
/// work was done before (the result row just had not been written) and it is recorded as applied.
/// </para>
/// See <c>docs/branch-server-design.md</c> §6.4.
/// </summary>
internal sealed class RelayExecutor(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<RelayExecutor> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!string.Equals(configuration["BranchSync:Mode"], "Branch", StringComparison.OrdinalIgnoreCase)) return;
        if (!Guid.TryParse(configuration["BranchSync:TenantId"], out var tenantId) ||
            !Guid.TryParse(configuration["BranchSync:BranchId"], out var branchId))
        {
            logger.LogWarning("Order relay: BranchSync TenantId / BranchId are not set; relayed orders will not be applied.");
            return;
        }

        try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue("BranchSync:StartupDelaySeconds", 300))), stoppingToken); }
        catch (OperationCanceledException) { return; }

        var interval = TimeSpan.FromSeconds(Math.Max(1, configuration.GetValue("BranchSync:IntervalSeconds", 5)));
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PassAsync(tenantId, branchId, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Order relay: a pass failed.");
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task PassAsync(Guid tenantId, Guid branchId, CancellationToken ct)
    {
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();

            var pending = await db.RelayedOrders.AsNoTracking()
                .Where(r => r.BranchId == branchId && !db.RelayedOrderResults.Any(x => x.Id == r.Id))
                .OrderBy(r => r.ReceivedAt).Take(20).ToListAsync(ct);

            foreach (var row in pending)
            {
                var (ok, number, message) = await ApplyAsync(row, tenantId, ct);
                db.RelayedOrderResults.Add(new RelayedOrderResult(row.Id, branchId, ok, number, message));
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Order relay: {Kind} {Id} - {Status}.", row.Kind, row.Id, ok ? "applied" : "rejected");
            }

            await ApplyPlatformAnswersAsync(db, branchId, ct);
        }
        finally { TenantAmbient.Clear(); }
    }

    /// <summary>Each relayed order runs in its own scope, so a failure cannot leave half-made changes on the
    /// context that records the result.</summary>
    private async Task<(bool Ok, string? Number, string? Message)> ApplyAsync(RelayedOrder row, Guid tenantId, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
        try
        {
            switch (row.Kind)
            {
                case RelayedOrder.QrOrder:
                {
                    if (await ExistingNumberAsync(db, row.Id, ct) is { } done) return (true, done, null);
                    var cmd = OrderRelay.Read<PlacePublicOrderCommand>(row);
                    if (cmd is null) return (false, null, "The relayed order could not be read.");
                    using var _ = RelayContext.Begin(row.Id);
                    var r = await scope.ServiceProvider.GetRequiredService<ISender>().Send(cmd, ct);
                    TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                    return r.IsSuccess ? (true, r.Value.OrderNumber, null) : (false, null, r.Error.Description);
                }

                case RelayedOrder.PlatformOrder:
                {
                    if (await ExistingNumberAsync(db, row.Id, ct) is { } done) return (true, done, null);
                    var p = OrderRelay.Read<PlatformOrderRelay>(row);
                    if (p is null) return (false, null, "The relayed order could not be read.");
                    var (parsed, error) = FoodpandaOrderParser.Parse(p.Body);
                    if (parsed is null) return (false, null, error);
                    var posDb = scope.ServiceProvider.GetRequiredService<Softaxis.POS.Infrastructure.Persistence.POSDbContext>();
                    var order = await PlatformOrderBuilder.BuildAsync(db, posDb, row.BranchId, p.Platform, parsed, row.Id, ct);
                    if (p.Accepted) { order.SetExternalStatus("accepted"); order.SendToKitchen(); }
                    await db.SaveChangesAsync(ct);
                    await Notify(scope, ct);
                    return (true, order.OrderNumber, null);
                }

                case RelayedOrder.PlatformCancel:
                {
                    var p = OrderRelay.Read<PlatformCancelRelay>(row);
                    if (p is null) return (false, null, "The cancellation could not be read.");
                    var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == p.OrderId, ct);
                    if (order is null) return (false, null, "The order is not on this branch.");
                    if (order.Status is "paid" or "cancelled") return (true, order.OrderNumber, $"Already {order.Status}; nothing to cancel.");
                    order.VoidWholeOrder($"Cancelled on Foodpanda{(string.IsNullOrWhiteSpace(p.Message) ? "" : ": " + p.Message)}", Guid.Empty);
                    db.OrderVoidLogs.Add(order.VoidLogs[^1]);   // new child row - EF would otherwise treat it as an update
                    order.SetExternalStatus("cancelled");
                    await db.SaveChangesAsync(ct);
                    await Notify(scope, ct);
                    return (true, order.OrderNumber, null);
                }

                default:
                    return (false, null, $"Unknown relay kind '{row.Kind}'.");
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Order relay: {Kind} {Id} failed.", row.Kind, row.Id);
            return (false, null, ex.Message);
        }
        finally { TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true); }
    }

    private static Task<string?> ExistingNumberAsync(RestaurantDbContext db, Guid id, CancellationToken ct) =>
        db.Orders.AsNoTracking().Where(o => o.Id == id).Select(o => (string?)o.OrderNumber).FirstOrDefaultAsync(ct);

    private static async Task Notify(IServiceScope scope, CancellationToken ct)
    {
        var realtime = scope.ServiceProvider.GetRequiredService<IRestaurantRealtimeNotifier>();
        await realtime.NotifyKitchenChangedAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);
    }

    /// <summary>The cloud answered an accept / reject asked at this till: finish it, or put the order back to "new".</summary>
    private static async Task ApplyPlatformAnswersAsync(RestaurantDbContext db, Guid branchId, CancellationToken ct)
    {
        var answers = await (
            from req in db.PlatformActionRequests
            join res in db.PlatformActionResults on req.Id equals res.Id
            join o in db.Orders on req.OrderId equals o.Id
            where req.BranchId == branchId &&
                  ((req.Action == PlatformActionRequest.Accept && o.ExternalStatus == "accepting") ||
                   (req.Action == PlatformActionRequest.Reject && o.ExternalStatus == "rejecting"))
            select new { req.Action, req.Reason, res.Status, o.Id })
            .Take(50).ToListAsync(ct);
        if (answers.Count == 0) return;

        foreach (var a in answers)
        {
            var order = await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == a.Id, ct);
            if (a.Status != PlatformActionResult.Done) { order.SetExternalStatus("new"); continue; }
            if (a.Action == PlatformActionRequest.Accept)
            {
                order.SetExternalStatus("accepted");
                order.SendToKitchen();
            }
            else
            {
                order.VoidWholeOrder($"Rejected on Foodpanda ({a.Reason})", Guid.Empty);
                db.OrderVoidLogs.Add(order.VoidLogs[^1]);
                order.SetExternalStatus("rejected");
            }
        }
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>
/// Runs on the CLOUD: carries out Foodpanda actions asked at a branch till (see
/// <see cref="BranchPlatformActions"/>), since only the cloud holds the Foodpanda credentials, and writes
/// the answer back for the branch.
/// </summary>
internal sealed class PlatformActionExecutor(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<PlatformActionExecutor> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!string.Equals(configuration["BranchSync:Mode"], "Cloud", StringComparison.OrdinalIgnoreCase)) return;

        try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, configuration.GetValue("BranchSync:StartupDelaySeconds", 60))), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PassAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Foodpanda relay: a pass failed.");
            }
            try { await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task PassAsync(CancellationToken ct)
    {
        List<(Guid Id, Guid? Tenant)> pending;
        using (var probe = scopes.CreateScope())
        {
            var db = probe.ServiceProvider.GetRequiredService<RestaurantDbContext>();
            // Across every workspace: no ambient tenant here, so the tenant is read from each row.
            pending = (await db.PlatformActionRequests.IgnoreQueryFilters()
                    .Where(r => !db.PlatformActionResults.IgnoreQueryFilters().Any(x => x.Id == r.Id))
                    .OrderBy(r => r.RequestedAt).Take(20)
                    .Select(r => new { r.Id, Tenant = EF.Property<Guid?>(r, TenantIsolation.Column) })
                    .ToListAsync(ct))
                .Select(x => (x.Id, x.Tenant)).ToList();
        }

        foreach (var (id, tenant) in pending)
        {
            if (tenant is null) continue;
            TenantAmbient.Set(tenant, isSuperAdmin: false, isResolved: true);
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
                var req = await db.PlatformActionRequests.FirstAsync(r => r.Id == id, ct);
                var outcome = await CarryOutAsync(scope, db, req, ct);
                if (outcome is null) continue;   // the order has not synced up yet - try again next pass
                db.PlatformActionResults.Add(new PlatformActionResult(req.Id, req.BranchId, outcome.Value.Ok, outcome.Value.Message));
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Foodpanda relay: {Action} for order {Order} - {Ok}.", req.Action, req.OrderId, outcome.Value.Ok);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Foodpanda relay: request {Id} failed.", id);
            }
            finally { TenantAmbient.Clear(); }
        }
    }

    private static async Task<(bool Ok, string? Message)?> CarryOutAsync(IServiceScope scope, RestaurantDbContext db,
        PlatformActionRequest req, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == req.OrderId, ct);
        if (order is null)
            return DateTime.UtcNow - req.RequestedAt > TimeSpan.FromMinutes(10)
                ? (false, "The order never reached head office.") : null;
        if (order.ExternalSource is null || order.ExternalToken is null) return (false, "Not a platform order.");

        var conn = await db.PlatformConnections.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Platform == order.ExternalSource && c.BranchId == order.BranchId, ct);
        if (conn is null) return (false, "The Foodpanda connection for this branch was removed.");
        var secrets = scope.ServiceProvider.GetRequiredService<ISecretProtector>();
        var creds = PlatformSupport.Creds(conn, secrets);
        if (creds is null) return (false, "Save the Foodpanda username and password first.");

        var client = scope.ServiceProvider.GetRequiredService<FoodpandaClient>();
        var res = req.Action switch
        {
            PlatformActionRequest.Accept => await client.AcceptAsync(creds, order.ExternalToken, order.Id.ToString(),
                DateTime.UtcNow.AddMinutes(req.PrepMinutes ?? conn.DefaultPrepMinutes), ct),
            PlatformActionRequest.Reject => await client.RejectAsync(creds, order.ExternalToken,
                RejectPlatformOrderHandler.Reasons.Contains(req.Reason ?? "") ? req.Reason! : "TECHNICAL_PROBLEM", req.Message, ct),
            PlatformActionRequest.HandOver => await client.PickedUpAsync(creds, order.ExternalToken, ct),
            _ => null,
        };
        return res is null ? (false, $"Unknown action '{req.Action}'.") : (res.Ok, res.Message);
    }
}
