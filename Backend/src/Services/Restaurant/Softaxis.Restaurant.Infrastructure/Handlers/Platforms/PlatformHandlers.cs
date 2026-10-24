using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Platforms;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Handlers.Orders;
using Softaxis.Restaurant.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Platforms;
using MediatR;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Platforms;

internal static class PlatformSupport
{
    public static string PluginBaseUrl(IConfiguration config, PlatformConnection c)
    {
        var root = (config["Integrations:PublicBaseUrl"] ?? config["FrontendUrl"] ?? "").TrimEnd('/');
        return $"{root}/api/restaurant/platforms/{c.Platform}/{c.InboundKey}";
    }

    public static PlatformConnectionDto ToDto(PlatformConnection c, IConfiguration config) => new(
        c.Id, c.Platform, c.Environment, c.BranchId, c.RemoteId, c.Username,
        !string.IsNullOrEmpty(c.PasswordEncrypted), !string.IsNullOrEmpty(c.PluginSecretEncrypted),
        c.AutoAccept, c.DefaultPrepMinutes, c.IsEnabled, PluginBaseUrl(config, c), c.LastOrderAt, c.LastError);

    public static FoodpandaClient.Creds? Creds(PlatformConnection c, ISecretProtector secrets)
    {
        var password = secrets.Unprotect(c.PasswordEncrypted);
        return string.IsNullOrEmpty(c.Username) || string.IsNullOrEmpty(password) ? null
            : new FoodpandaClient.Creds(c.Environment, c.Username, password);
    }

    /// <summary>Finds the connection an anonymous platform call is addressed to and enters its workspace.
    /// Must be awaited directly from the handler: the tenant set here flows only downward.</summary>
    public static async Task<PlatformConnection?> ResolveAsync(RestaurantDbContext db, string inboundKey, CancellationToken ct)
    {
        var c = await db.PlatformConnections.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.InboundKey == inboundKey, ct);
        var tenant = c is null ? null : db.Entry(c).Property<Guid?>(TenantIsolation.Column).CurrentValue;
        return tenant is null ? null : c;
    }

    public static Guid? TenantOf(RestaurantDbContext db, PlatformConnection c) =>
        db.Entry(c).Property<Guid?>(TenantIsolation.Column).CurrentValue;
}

internal sealed class GetPlatformConnectionsHandler(RestaurantDbContext db, IConfiguration config)
    : IQueryHandler<GetPlatformConnectionsQuery, IReadOnlyList<PlatformConnectionDto>>
{
    public async Task<Result<IReadOnlyList<PlatformConnectionDto>>> Handle(GetPlatformConnectionsQuery q, CancellationToken ct)
    {
        var rows = await db.PlatformConnections.AsNoTracking().OrderBy(x => x.CreatedAt).ToListAsync(ct);
        IReadOnlyList<PlatformConnectionDto> list = rows.Select(r => PlatformSupport.ToDto(r, config)).ToList();
        return Result.Success(list);
    }
}

internal sealed class SavePlatformConnectionHandler(
    RestaurantDbContext db, ISecretProtector secrets, IConfiguration config, IBranchAccessGuard branches)
    : ICommandHandler<SavePlatformConnectionCommand, PlatformConnectionDto>
{
    public async Task<Result<PlatformConnectionDto>> Handle(SavePlatformConnectionCommand c, CancellationToken ct)
    {
        if (!await branches.CanWriteToBranchAsync(c.BranchId, ct))
            return Result.Failure<PlatformConnectionDto>(Error.Custom("Branch.Forbidden", "You are not assigned to this branch."));

        var remote = c.RemoteId.Trim();
        var clash = await db.PlatformConnections.AnyAsync(x => x.Platform == c.Platform && x.RemoteId == remote && x.Id != c.Id, ct);
        if (clash)
            return Result.Failure<PlatformConnectionDto>(Error.Custom("Platform.Duplicate",
                "Another branch already uses this Foodpanda vendor id."));

        PlatformConnection conn;
        if (c.Id is { } id)
        {
            var found = await db.PlatformConnections.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (found is null) return Result.Failure<PlatformConnectionDto>(Error.NotFoundById("PlatformConnection", id));
            conn = found;
        }
        else
        {
            var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
            conn = new PlatformConnection(c.Platform, c.BranchId, remote, key);
            db.PlatformConnections.Add(conn);
        }

        conn.Configure(c.Environment, c.BranchId, remote, c.Username,
            string.IsNullOrWhiteSpace(c.Password) ? null : secrets.Protect(c.Password.Trim()),
            string.IsNullOrWhiteSpace(c.PluginSecret) ? null : secrets.Protect(c.PluginSecret.Trim()),
            c.AutoAccept, c.DefaultPrepMinutes, c.IsEnabled);
        await db.SaveChangesAsync(ct);
        return Result.Success(PlatformSupport.ToDto(conn, config));
    }
}

internal sealed class DeletePlatformConnectionHandler(RestaurantDbContext db) : ICommandHandler<DeletePlatformConnectionCommand>
{
    public async Task<Result> Handle(DeletePlatformConnectionCommand c, CancellationToken ct)
    {
        var conn = await db.PlatformConnections.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (conn is null) return Result.Failure(Error.NotFoundById("PlatformConnection", c.Id));
        db.PlatformConnections.Remove(conn);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class TestPlatformConnectionHandler(RestaurantDbContext db, ISecretProtector secrets, FoodpandaClient client)
    : ICommandHandler<TestPlatformConnectionCommand, PlatformTestResultDto>
{
    public async Task<Result<PlatformTestResultDto>> Handle(TestPlatformConnectionCommand c, CancellationToken ct)
    {
        var conn = await db.PlatformConnections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (conn is null) return Result.Failure<PlatformTestResultDto>(Error.NotFoundById("PlatformConnection", c.Id));
        var creds = PlatformSupport.Creds(conn, secrets);
        if (creds is null) return Result.Success(new PlatformTestResultDto(false, "Save the Foodpanda username and password first."));
        var (token, message) = await client.SignInAsync(creds.Environment, creds.Username, creds.Password, ct, fresh: true);
        return Result.Success(new PlatformTestResultDto(token is not null, message));
    }
}

/// <summary>A Foodpanda order arrives: it becomes a delivery bill on the branch's till.</summary>
internal sealed class IngestPlatformOrderHandler(
    RestaurantDbContext db, ISecretProtector secrets, FoodpandaClient client, IRestaurantRealtimeNotifier realtime,
    Softaxis.POS.Infrastructure.Persistence.POSDbContext posDb, LocalBranchGuard localBranch, OrderRelay relay)
    : ICommandHandler<IngestPlatformOrderCommand, IngestPlatformOrderResult>
{
    public async Task<Result<IngestPlatformOrderResult>> Handle(IngestPlatformOrderCommand cmd, CancellationToken ct)
    {
        var conn = await PlatformSupport.ResolveAsync(db, cmd.InboundKey, ct);
        if (conn is null || !string.Equals(conn.RemoteId, cmd.RemoteId.Trim(), StringComparison.OrdinalIgnoreCase))
            return Result.Failure<IngestPlatformOrderResult>(Error.Custom("Platform.NotFound", "Unknown vendor."));
        TenantAmbient.Set(PlatformSupport.TenantOf(db, conn), isSuperAdmin: false, isResolved: true);

        if (!FoodpandaOrderParser.IsAuthorized(secrets.Unprotect(conn.PluginSecretEncrypted), conn.Environment, cmd.Authorization))
            return Result.Failure<IngestPlatformOrderResult>(Error.Custom("Platform.Unauthorized", "Invalid plugin secret."));
        if (!conn.IsEnabled)
            return Result.Failure<IngestPlatformOrderResult>(Error.Custom("Platform.Conflict", "This branch is not taking Foodpanda orders."));

        // A branch with its own server owns its bills: the order is relayed to it, but only while it is
        // reachable - otherwise Foodpanda gets no acceptance and handles the timeout itself.
        var relayed = await localBranch.IsLocalAsync(conn.BranchId, ct);
        if (relayed && !relay.BranchOnline(conn.BranchId))
            return Result.Failure<IngestPlatformOrderResult>(Error.Custom("Platform.Conflict", "This branch is offline and cannot take Foodpanda orders right now."));

        var (parsed, parseError) = FoodpandaOrderParser.Parse(cmd.Body);
        if (parsed is null)
        {
            conn.RecordError(parseError!);
            await db.SaveChangesAsync(ct);
            return Result.Failure<IngestPlatformOrderResult>(Error.Custom("Validation.Failed", parseError!));
        }

        // Foodpanda resends an order it did not get an answer for; it must not become two bills.
        var existing = await db.Orders.AsNoTracking()
            .Where(o => o.ExternalSource == conn.Platform && o.ExternalOrderId == parsed.Token)
            .Select(o => (Guid?)o.Id).FirstOrDefaultAsync(ct);
        if (existing is { } dup) return Result.Success(new IngestPlatformOrderResult(dup, true));

        if (relayed)
        {
            var queued = await db.RelayedOrders.AsNoTracking()
                .Where(r => r.Kind == RelayedOrder.PlatformOrder && r.ExternalRef == parsed.Token)
                .Select(r => (Guid?)r.Id).FirstOrDefaultAsync(ct);
            if (queued is { } q) return Result.Success(new IngestPlatformOrderResult(q, true));

            var id = Guid.NewGuid();
            // Only the cloud holds the Foodpanda credentials, so auto-accept is done here, with the id the
            // branch will give the bill (Foodpanda refers back to that id in later status calls).
            var accepted = false;
            if (conn.AutoAccept && PlatformSupport.Creds(conn, secrets) is { } creds)
            {
                var res = await client.AcceptAsync(creds, parsed.Token, id.ToString(), DateTime.UtcNow.AddMinutes(conn.DefaultPrepMinutes), ct);
                accepted = res.Ok;
                if (!res.Ok) conn.RecordError(res.Message);
            }
            relay.Queue(id, conn.BranchId, RelayedOrder.PlatformOrder, new PlatformOrderRelay(conn.Platform, cmd.Body, accepted), parsed.Token);
            conn.RecordOrder();
            await db.SaveChangesAsync(ct);
            return Result.Success(new IngestPlatformOrderResult(id, false));
        }

        var order = await PlatformOrderBuilder.BuildAsync(db, posDb, conn.BranchId, conn.Platform, parsed, null, ct);
        conn.RecordOrder();
        await db.SaveChangesAsync(ct);

        if (conn.AutoAccept)
            await PlatformOrderActions.AcceptAsync(db, client, secrets, conn, order, conn.DefaultPrepMinutes, ct);

        await realtime.NotifyKitchenChangedAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);
        return Result.Success(new IngestPlatformOrderResult(order.Id, false));
    }
}

/// <summary>Turns a parsed Foodpanda order into a delivery bill (adds it to the context; the caller saves).
/// Used on the cloud for a cloud-run branch, and on a branch server for an order relayed to it.</summary>
internal static class PlatformOrderBuilder
{
    public static async Task<Order> BuildAsync(RestaurantDbContext db, Softaxis.POS.Infrastructure.Persistence.POSDbContext posDb,
        Guid? branchId, string platform, FoodpandaOrder parsed, Guid? id, CancellationToken ct)
    {
        var tax = await TaxProfileResolver.ResolveAsync(db, posDb, branchId, ct);
        var session = await PosSessionLedger.FindOpenSessionAsync(db, branchId, ct);
        var label = parsed.ExpeditionType == "pickup" ? "Foodpanda pickup" : "Foodpanda";
        var order = new Order(Guid.Empty, label.Length > 20 ? "Foodpanda" : label, "Foodpanda", 1, "delivery",
            Notes(parsed), branchId, session, cashierId: null, orderChannel: platform);
        if (id is { } relayId) order.UseRelayedId(relayId);

        // Match lines to the menu by the code set on Foodpanda's side (our menu item id) or by name.
        var menu = await db.MenuItems.AsNoTracking().Where(m => !m.IsDeleted)
            .Select(m => new { m.Id, m.Name }).ToListAsync(ct);
        foreach (var l in parsed.Lines)
        {
            var menuId = Guid.TryParse(l.RemoteCode, out var g) && menu.Any(m => m.Id == g) ? g
                : menu.FirstOrDefault(m => string.Equals(m.Name, l.Name, StringComparison.OrdinalIgnoreCase))?.Id ?? Guid.Empty;
            // Foodpanda's prices include tax; the bill adds tax on top, so lines are stored net of it.
            var unitNet = Math.Round(l.GrossTotal / l.Quantity / (1 + tax.Rate / 100m), 2);
            var mods = string.Join(", ", l.Options.Concat(string.IsNullOrWhiteSpace(l.Comment) ? [] : [$"Note: {l.Comment}"]));
            order.Items.Add(new OrderItem(order.Id, menuId, Trim(l.Name, 200), l.Quantity, unitNet, mods.Length == 0 ? null : Trim(mods, 500)));
        }
        // No FBR POS fee on platform orders: the customer paid Foodpanda's price, nothing more.
        order.ApplyTax(tax.Rate, tax.Label, 0m, tax.ReportToFbr);
        order.MarkExternal(platform, parsed.Token, parsed.Code, parsed.Token);
        db.Orders.Add(order);
        return order;
    }

    private static string Notes(FoodpandaOrder o)
    {
        var parts = new List<string> { $"Foodpanda #{o.Code ?? o.Token[..Math.Min(8, o.Token.Length)]}" };
        if (o.IsTest) parts.Add("TEST ORDER");
        if (o.CustomerName is not null) parts.Add(o.CustomerName);
        if (o.CustomerPhone is not null) parts.Add(o.CustomerPhone);
        if (o.Address is not null) parts.Add(o.Address);
        if (o.PaymentType is not null) parts.Add($"Payment: {o.PaymentType}");
        if (o.Comment is not null) parts.Add($"Note: {o.Comment}");
        return Trim(string.Join(" · ", parts), 1000);
    }

    private static string Trim(string s, int max) => s.Length > max ? s[..max] : s;
}

internal static class PlatformOrderActions
{
    public static async Task<Result> AcceptAsync(RestaurantDbContext db, FoodpandaClient client, ISecretProtector secrets,
        PlatformConnection conn, Order order, int prepMinutes, CancellationToken ct)
    {
        var creds = PlatformSupport.Creds(conn, secrets);
        if (creds is null) return Fail(conn, "Save the Foodpanda username and password to accept orders.");
        var res = await client.AcceptAsync(creds, order.ExternalToken!, order.Id.ToString(), DateTime.UtcNow.AddMinutes(prepMinutes), ct);
        if (!res.Ok) { conn.RecordError(res.Message); await db.SaveChangesAsync(ct); return Result.Failure(Error.Custom("Platform.Conflict", res.Message)); }
        order.SetExternalStatus("accepted");
        order.SendToKitchen();
        await db.SaveChangesAsync(ct);
        return Result.Success();

        Result Fail(PlatformConnection c, string m) { c.RecordError(m); return Result.Failure(Error.Custom("Platform.NotConfigured", m)); }
    }
}

/// <summary>Foodpanda tells us the order changed on their side — only cancellation matters here.</summary>
internal sealed class PlatformOrderStatusHandler(RestaurantDbContext db, ISecretProtector secrets, IRestaurantRealtimeNotifier realtime,
    LocalBranchGuard localBranch, OrderRelay relay)
    : ICommandHandler<PlatformOrderStatusCommand>
{
    public async Task<Result> Handle(PlatformOrderStatusCommand cmd, CancellationToken ct)
    {
        var conn = await PlatformSupport.ResolveAsync(db, cmd.InboundKey, ct);
        if (conn is null || !string.Equals(conn.RemoteId, cmd.RemoteId.Trim(), StringComparison.OrdinalIgnoreCase))
            return Result.Failure(Error.Custom("Platform.NotFound", "Unknown vendor."));
        TenantAmbient.Set(PlatformSupport.TenantOf(db, conn), isSuperAdmin: false, isResolved: true);
        if (!FoodpandaOrderParser.IsAuthorized(secrets.Unprotect(conn.PluginSecretEncrypted), conn.Environment, cmd.Authorization))
            return Result.Failure(Error.Custom("Platform.Unauthorized", "Invalid plugin secret."));

        string? status = null, message = null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(cmd.Body);
            status = FoodpandaOrderParser.Str(doc.RootElement, "status");
            message = FoodpandaOrderParser.Str(doc.RootElement, "message");
        }
        catch (System.Text.Json.JsonException) { return Result.Failure(Error.Custom("Validation.Failed", "Not valid JSON.")); }

        var order = Guid.TryParse(cmd.RemoteOrderId, out var id)
            ? await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id && o.ExternalSource == conn.Platform, ct)
            : null;
        var cancelled = string.Equals(status, "ORDER_CANCELLED", StringComparison.OrdinalIgnoreCase);

        // The bill lives on a branch server: pass the cancellation on rather than changing the cloud's copy.
        // The order may still be only a relay row (the branch has not synced it up yet).
        if (await localBranch.IsLocalAsync(conn.BranchId, ct))
        {
            var known = order is not null || await db.RelayedOrders.AnyAsync(r => r.Id == id && r.Kind == RelayedOrder.PlatformOrder, ct);
            if (!known) return Result.Failure(Error.Custom("Order.NotFound", "Unknown order."));
            if (cancelled && order?.Status is not ("paid" or "cancelled"))
            {
                relay.Queue(Guid.NewGuid(), conn.BranchId, RelayedOrder.PlatformCancel, new PlatformCancelRelay(id, message));
                await db.SaveChangesAsync(ct);
            }
            return Result.Success();
        }

        if (order is null) return Result.Failure(Error.Custom("Order.NotFound", "Unknown order."));

        if (string.Equals(status, "ORDER_CANCELLED", StringComparison.OrdinalIgnoreCase) && order.Status is not ("paid" or "cancelled"))
        {
            order.VoidWholeOrder($"Cancelled on Foodpanda{(string.IsNullOrWhiteSpace(message) ? "" : ": " + message)}", Guid.Empty);
            db.OrderVoidLogs.Add(order.VoidLogs[^1]);   // new child row — EF would otherwise treat it as an update
            order.SetExternalStatus("cancelled");
            await db.SaveChangesAsync(ct);
            await realtime.NotifyKitchenChangedAsync(ct);
        }
        return Result.Success();
    }
}

internal sealed class AcceptPlatformOrderHandler(RestaurantDbContext db, ISecretProtector secrets, FoodpandaClient client, IRestaurantRealtimeNotifier realtime, IConfiguration config)
    : ICommandHandler<AcceptPlatformOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(AcceptPlatformOrderCommand cmd, CancellationToken ct)
    {
        if (BranchPlatformActions.OnBranch(config))
            return await BranchPlatformActions.RequestAsync(db, cmd.OrderId, "new", PlatformActionRequest.Accept, "accepting", cmd.PrepMinutes, null, null, ct);
        var (order, conn, error) = await PlatformLookup.LoadAsync(db, cmd.OrderId, ct);
        if (error is not null) return Result.Failure<OrderDto>(error);
        if (order!.ExternalStatus != "new")
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "This Foodpanda order has already been answered."));
        var r = await PlatformOrderActions.AcceptAsync(db, client, secrets, conn!, order, cmd.PrepMinutes ?? conn!.DefaultPrepMinutes, ct);
        if (r.IsFailure) return Result.Failure<OrderDto>(r.Error);
        await realtime.NotifyKitchenChangedAsync(ct);
        return Result.Success(OrderMappings.ToDto(order));
    }
}

internal sealed class RejectPlatformOrderHandler(RestaurantDbContext db, ISecretProtector secrets, FoodpandaClient client, IRestaurantRealtimeNotifier realtime, IConfiguration config)
    : ICommandHandler<RejectPlatformOrderCommand, OrderDto>
{
    /// <summary>Delivery Hero's rejection reasons.</summary>
    internal static readonly HashSet<string> Reasons =
    [
        "CLOSED", "ITEM_UNAVAILABLE", "TOO_BUSY", "TECHNICAL_PROBLEM", "UNABLE_TO_DELIVER", "ADDRESS_INCOMPLETE_MISSTATED",
        "BLACKLISTED", "UNREACHABLE", "OUTSIDE_DELIVERY_AREA", "MENU_ACCOUNT_SETTINGS", "FOOD_QUALITY_SPILLAGE",
        "CONTENT_WRONG_INCOMPLETE",
    ];

    public async Task<Result<OrderDto>> Handle(RejectPlatformOrderCommand cmd, CancellationToken ct)
    {
        if (BranchPlatformActions.OnBranch(config))
            return await BranchPlatformActions.RequestAsync(db, cmd.OrderId, "new", PlatformActionRequest.Reject, "rejecting", null, cmd.Reason, cmd.Message, ct);
        var (order, conn, error) = await PlatformLookup.LoadAsync(db, cmd.OrderId, ct);
        if (error is not null) return Result.Failure<OrderDto>(error);
        if (order!.ExternalStatus != "new")
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "This Foodpanda order has already been answered."));
        var reason = Reasons.Contains(cmd.Reason) ? cmd.Reason : "TECHNICAL_PROBLEM";
        var creds = PlatformSupport.Creds(conn!, secrets);
        if (creds is null) return Result.Failure<OrderDto>(Error.Custom("Platform.NotConfigured", "Save the Foodpanda username and password first."));
        var res = await client.RejectAsync(creds, order.ExternalToken!, reason, cmd.Message, ct);
        if (!res.Ok) return Result.Failure<OrderDto>(Error.Custom("Platform.Conflict", res.Message));

        order.VoidWholeOrder($"Rejected on Foodpanda ({reason})", Guid.Empty);
            db.OrderVoidLogs.Add(order.VoidLogs[^1]);   // new child row — EF would otherwise treat it as an update
        order.SetExternalStatus("rejected");
        await db.SaveChangesAsync(ct);
        await realtime.NotifyKitchenChangedAsync(ct);
        return Result.Success(OrderMappings.ToDto(order));
    }
}

internal sealed class HandOverPlatformOrderHandler(RestaurantDbContext db, ISecretProtector secrets, FoodpandaClient client, ISender sender, IConfiguration config)
    : ICommandHandler<HandOverPlatformOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(HandOverPlatformOrderCommand cmd, CancellationToken ct)
    {
        if (BranchPlatformActions.OnBranch(config))
        {
            // The food has left; Foodpanda is told through the cloud, and the bill is settled here.
            var asked = await BranchPlatformActions.RequestAsync(db, cmd.OrderId, "accepted", PlatformActionRequest.HandOver, null, null, null, null, ct);
            if (asked.IsFailure) return asked;
            db.ChangeTracker.Clear();
            return asked.Value.Status == "paid" ? asked : await sender.Send(new PayOrderCommand(cmd.OrderId, "Foodpanda"), ct);
        }
        var (order, conn, error) = await PlatformLookup.LoadAsync(db, cmd.OrderId, ct);
        if (error is not null) return Result.Failure<OrderDto>(error);
        if (order!.ExternalStatus != "accepted")
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "Accept the order before handing it over."));

        var creds = PlatformSupport.Creds(conn!, secrets);
        if (creds is not null)
        {
            var res = await client.PickedUpAsync(creds, order.ExternalToken!, ct);
            // The food has left either way; record it, and show why Foodpanda was not told.
            if (!res.Ok) { conn!.RecordError(res.Message); await db.SaveChangesAsync(ct); }
        }

        // Foodpanda collects the money and pays the restaurant, so the bill is settled to Foodpanda.
        db.ChangeTracker.Clear();
        return order.Status == "paid"
            ? Result.Success(OrderMappings.ToDto(order))
            : await sender.Send(new PayOrderCommand(order.Id, "Foodpanda"), ct);
    }
}

internal static class PlatformLookup
{
    public static async Task<(Order? Order, PlatformConnection? Conn, Error? Error)> LoadAsync(
        RestaurantDbContext db, Guid orderId, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, ct);
        if (order is null || order.ExternalSource is null) return (null, null, Error.NotFoundById("Order", orderId));
        var conn = await db.PlatformConnections.FirstOrDefaultAsync(
            c => c.Platform == order.ExternalSource && c.BranchId == order.BranchId, ct);
        return conn is null
            ? (null, null, Error.Custom("Platform.NotConfigured", "The Foodpanda connection for this branch was removed."))
            : (order, conn, null);
    }
}

/// <summary>
/// On a BRANCH server the Foodpanda credentials are not available (they never leave the cloud), so an
/// accept / reject / hand-over pressed at the till is recorded as a <see cref="PlatformActionRequest"/>
/// that flows up; the cloud calls Foodpanda and its answer flows back down (<c>RelayExecutor</c> applies it).
/// Meanwhile the bill shows "accepting" / "rejecting" so it is not answered twice.
/// </summary>
internal static class BranchPlatformActions
{
    public static bool OnBranch(IConfiguration config) =>
        string.Equals(config["BranchSync:Mode"], "Branch", StringComparison.OrdinalIgnoreCase);

    public static async Task<Result<OrderDto>> RequestAsync(RestaurantDbContext db, Guid orderId, string requiredStatus,
        string action, string? pendingStatus, int? prepMinutes, string? reason, string? message, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, ct);
        if (order is null || order.ExternalSource is null) return Result.Failure<OrderDto>(Error.NotFoundById("Order", orderId));
        if (order.ExternalStatus != requiredStatus)
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", requiredStatus == "new"
                ? "This Foodpanda order has already been answered."
                : "Accept the order before handing it over."));
        if (order.BranchId is not { } branchId)
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "This order has no branch."));

        db.PlatformActionRequests.Add(new PlatformActionRequest(branchId, order.Id, action, prepMinutes, reason, message));
        if (pendingStatus is not null) order.SetExternalStatus(pendingStatus);
        await db.SaveChangesAsync(ct);
        return Result.Success(OrderMappings.ToDto(order));
    }
}
