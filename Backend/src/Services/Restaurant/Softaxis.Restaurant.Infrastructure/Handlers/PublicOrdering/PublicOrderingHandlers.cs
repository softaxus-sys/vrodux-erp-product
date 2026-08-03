using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.PublicOrdering.Commands;
using Softaxis.Restaurant.Application.PublicOrdering.Dtos;
using Softaxis.Restaurant.Application.PublicOrdering.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.PublicOrdering;

/// <summary>Shared helper — resolves a Table by its public QrCode (no ambient tenant exists yet for an
/// anonymous request, hence IgnoreQueryFilters) and adopts that table's tenant as the ambient one for
/// the rest of the request, so every subsequent EF operation (reads, inserts, StampTenantId) behaves
/// exactly like an authenticated request. Mirrors the CRM RawLeadInboxProcessor / Careers pattern.</summary>
internal static class PublicOrderingTenantResolver
{
    public static async Task<Table?> ResolveTableAndSetAmbientAsync(RestaurantDbContext db, string qrCode, CancellationToken ct)
    {
        var table = await db.Tables.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.QrCode == qrCode && !x.IsDeleted, ct);
        if (table is null) return null;

        var tenantId = db.Entry(table).Property<Guid?>(TenantIsolation.Column).CurrentValue;
        if (tenantId is null) return null;

        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
        return table;
    }
}

internal sealed class GetPublicMenuHandler(RestaurantDbContext db) : IQueryHandler<GetPublicMenuQuery, PublicMenuDto>
{
    public async Task<Result<PublicMenuDto>> Handle(GetPublicMenuQuery query, CancellationToken ct)
    {
        var table = await PublicOrderingTenantResolver.ResolveTableAndSetAmbientAsync(db, query.QrCode, ct);
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

internal sealed class PlacePublicOrderHandler(RestaurantDbContext db) : ICommandHandler<PlacePublicOrderCommand, PublicOrderPlacedDto>
{
    public async Task<Result<PublicOrderPlacedDto>> Handle(PlacePublicOrderCommand cmd, CancellationToken ct)
    {
        var table = await PublicOrderingTenantResolver.ResolveTableAndSetAmbientAsync(db, cmd.QrCode, ct);
        if (table is null) return Result.Failure<PublicOrderPlacedDto>(Error.Custom("Table.NotFound", "Invalid QR code."));
        if (table.Status == "occupied")
            return Result.Failure<PublicOrderPlacedDto>(Error.Custom("PublicOrder.Conflict",
                "This table already has an active order — please ask staff for assistance."));

        var channel = cmd.Channel == "kiosk" ? "kiosk" : "qr_table";
        var order = new Order(table.Id, table.TableNumber, "Guest", 1, "dine_in", cmd.Notes, orderChannel: channel);

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
        order.Recalculate();

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
