using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Kitchen.Dtos;
using Softaxis.Restaurant.Application.Kitchen.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Kitchen;

internal sealed class GetKitchenTicketsHandler(RestaurantDbContext db)
    : IQueryHandler<GetKitchenTicketsQuery, IReadOnlyList<KitchenTicketDto>>
{
    public async Task<Result<IReadOnlyList<KitchenTicketDto>>> Handle(GetKitchenTicketsQuery query, CancellationToken ct)
    {
        var orders = await db.Orders.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted && (x.Status == "sent" || x.Status == "ready"))
            .OrderBy(x => x.CreatedAt).ToListAsync(ct);

        var menuItemIds = orders.SelectMany(o => o.Items).Where(i => !i.IsDeleted).Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems.AsNoTracking()
            .Where(m => menuItemIds.Contains(m.Id))
            .Select(m => new { m.Id, m.CategoryId, m.KitchenStationId })
            .ToListAsync(ct);
        var categoryIds = menuItems.Where(m => m.KitchenStationId is null).Select(m => m.CategoryId).Distinct().ToList();
        var categoryStations = await db.MenuCategories.AsNoTracking()
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.KitchenStationId, ct);
        var stationByMenuItem = menuItems.ToDictionary(
            m => m.Id,
            m => m.KitchenStationId ?? (categoryStations.TryGetValue(m.CategoryId, out var s) ? s : null));

        var now = DateTime.UtcNow;
        var tickets = new List<KitchenTicketDto>();
        foreach (var o in orders)
        {
            var items = o.Items
                .Where(i => !i.IsDeleted && i.CourseNumber <= o.CurrentCourse)
                .Select(i => new KitchenTicketItemDto(
                    i.Id, i.ItemName, i.Quantity, i.Modifiers, i.Status,
                    i.CourseNumber, i.ComboOrderItemId,
                    stationByMenuItem.TryGetValue(i.MenuItemId, out var st) ? st : null))
                .Where(i => query.StationId is null || i.KitchenStationId == query.StationId)
                .ToList();

            if (query.StationId is not null && items.Count == 0) continue;

            tickets.Add(new KitchenTicketDto(
                o.Id, o.OrderNumber, o.TableNumber, o.Waiter, o.Covers, o.Status, o.CreatedAt,
                (int)(now - o.CreatedAt).TotalMinutes, o.CurrentCourse, items));
        }

        return Result.Success<IReadOnlyList<KitchenTicketDto>>(tickets);
    }
}
