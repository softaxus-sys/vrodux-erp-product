using Softaxis.Restaurant.Infrastructure.Common;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.PublicOrdering.Commands;
using Softaxis.Restaurant.Application.PublicOrdering.Dtos;
using Softaxis.Restaurant.Application.PublicOrdering.Queries;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.PublicOrdering;

/// <summary>Shared helper — resolves a Table by its public QrCode (no ambient tenant exists yet for an
/// anonymous request, hence IgnoreQueryFilters), then <see cref="Enter"/> adopts that table's tenant as the
/// ambient one for the rest of the request, so every later EF operation (reads, inserts, StampTenantId)
/// behaves like an authenticated request.
///
/// <para>
/// <b>Two calls, on purpose.</b> <c>TenantAmbient</c> is an AsyncLocal: a value set inside an <c>async</c>
/// method is gone when that method returns. The earlier single async helper set it and lost it, so QR orders
/// were saved with no workspace and the public menu read ran with no workspace filter. <see cref="Enter"/> is
/// a plain method, so the value it sets stays with the caller.
/// </para></summary>
internal static class PublicOrderingTenantResolver
{
    public static Task<Table?> FindTableAsync(RestaurantDbContext db, string qrCode, CancellationToken ct) =>
        db.Tables.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.QrCode == qrCode && !x.IsDeleted, ct);

    /// <summary>Sets the table's workspace as the ambient tenant. False when the table has none.</summary>
    public static bool Enter(RestaurantDbContext db, Table table)
    {
        var tenantId = db.Entry(table).Property<Guid?>(TenantIsolation.Column).CurrentValue;
        if (tenantId is null) return false;
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
        return true;
    }
}

internal sealed class GetPublicMenuHandler(RestaurantDbContext db) : IQueryHandler<GetPublicMenuQuery, PublicMenuDto>
{
    public async Task<Result<PublicMenuDto>> Handle(GetPublicMenuQuery query, CancellationToken ct)
    {
        var table = await PublicOrderingTenantResolver.FindTableAsync(db, query.QrCode, ct);
        if (table is not null && !PublicOrderingTenantResolver.Enter(db, table)) table = null;
        if (table is null) return Result.Failure<PublicMenuDto>(Error.Custom("Table.NotFound", "Invalid QR code."));

        var categories = await db.MenuCategories.AsNoTracking()
            .Include(c => c.Items)
            .Where(c => !c.IsDeleted && c.IsActive)
            .OrderBy(c => c.SortOrder).ToListAsync(ct);

        var dto = categories
            .Select(c => new PublicMenuCategoryDto(c.Id, c.Name, c.Description,
                c.Items.Where(i => !i.IsDeleted && i.IsAvailable && i.IsOnlineOrderable)
                    .Select(i => new PublicMenuItemDto(i.Id, i.Name, i.Description, i.Price, i.Allergens))
                    .ToList()))
            .Where(c => c.Items.Count > 0)
            .ToList();

        return Result.Success(new PublicMenuDto(table.Id, table.TableNumber, dto));
    }
}

internal sealed class PlacePublicOrderHandler(RestaurantDbContext db, Softaxis.POS.Infrastructure.Persistence.POSDbContext posDb, LocalBranchGuard localBranch, OrderRelay relay) : ICommandHandler<PlacePublicOrderCommand, PublicOrderPlacedDto>
{
    public async Task<Result<PublicOrderPlacedDto>> Handle(PlacePublicOrderCommand cmd, CancellationToken ct)
    {
        var table = await PublicOrderingTenantResolver.FindTableAsync(db, cmd.QrCode, ct);
        if (table is not null && !PublicOrderingTenantResolver.Enter(db, table)) table = null;
        if (table is null) return Result.Failure<PublicOrderPlacedDto>(Error.Custom("Table.NotFound", "Invalid QR code."));

        // QR / kiosk orders reach the cloud only. For a branch on its own server the bill is written there:
        // the order is checked here (so the guest hears about a bad item at once), then relayed to the branch.
        // The cloud's copy of the table status is not live for such a branch, so "occupied" is the branch's call.
        var relayed = await localBranch.IsLocalAsync(table.BranchId, ct);
        if (relayed && !relay.BranchOnline(table.BranchId!.Value))
            return Result.Failure<PublicOrderPlacedDto>(Error.Custom("PublicOrder.Conflict",
                "This restaurant is not taking table orders online right now - please ask staff."));

        if (!relayed && table.Status == "occupied")
            return Result.Failure<PublicOrderPlacedDto>(Error.Custom("PublicOrder.Conflict",
                "This table already has an active order — please ask staff for assistance."));

        var channel = cmd.Channel == "kiosk" ? "kiosk" : "qr_table";
        var order = new Order(table.Id, table.TableNumber, "Guest", 1, "dine_in", cmd.Notes, branchId: table.BranchId, orderChannel: channel);
        // Replaying an order the cloud relayed: keep the id the guest was given.
        if (RelayContext.OrderId is { } relayId) order.UseRelayedId(relayId);

        // No structured-modifier support in the guest-facing flow yet (v1 scope cut, flagged) —
        // free-text Modifiers only, same field OrderItemFactory snapshots for staff-entered lines.
        foreach (var li in cmd.Items)
        {
            var menuItem = await db.MenuItems.FirstOrDefaultAsync(
                m => m.Id == li.MenuItemId && !m.IsDeleted && m.IsAvailable && m.IsOnlineOrderable, ct);
            if (menuItem is null)
                return Result.Failure<PublicOrderPlacedDto>(Error.Custom("MenuItem.NotFound", "One or more items are no longer available."));

            order.Items.Add(new OrderItem(order.Id, menuItem.Id, menuItem.Name, li.Quantity, menuItem.Price, li.Modifiers));
        }
        var tax = await TaxProfileResolver.ResolveAsync(db, posDb, table.BranchId, ct);
        order.ApplyTax(tax.Rate, tax.Label, tax.ServiceFee, tax.ReportToFbr);

        if (relayed)
        {
            // Nothing is written to the bill tables here; the branch creates the bill from this row.
            relay.Queue(order.Id, table.BranchId!.Value, RelayedOrder.QrOrder, cmd);
            await db.SaveChangesAsync(ct);
            return Result.Success(new PublicOrderPlacedDto(order.Id, "Sent to the restaurant", order.Total));
        }

        db.Orders.Add(order);
        table.Occupy(order.Id, "Guest (QR)");

        var session = await db.TableOrderingSessions
            .FirstOrDefaultAsync(s => s.TableId == table.Id && s.GuestDeviceToken == cmd.GuestDeviceToken, ct);
        if (session is null) db.TableOrderingSessions.Add(new TableOrderingSession(table.Id, cmd.GuestDeviceToken));
        else session.Touch();

        await db.SaveChangesAsync(ct);
        return Result.Success(new PublicOrderPlacedDto(order.Id, order.OrderNumber, order.Total));
    }
}
