using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class GetMenuItemsHandler(RestaurantDbContext db)
    : IQueryHandler<GetMenuItemsQuery, IReadOnlyList<MenuItemDto>>
{
    public async Task<Result<IReadOnlyList<MenuItemDto>>> Handle(GetMenuItemsQuery query, CancellationToken ct)
    {
        var q = db.MenuItems.AsNoTracking().Where(x => !x.IsDeleted);
        if (query.CategoryId.HasValue) q = q.Where(x => x.CategoryId == query.CategoryId.Value);

        var items = await q.OrderBy(x => x.Name).ToListAsync(ct);
        var groupsByItem = await ModifierGroupLookup.GetGroupsForItemsAsync(db, items.Select(i => i.Id).ToList(), ct);

        var dtos = items.Select(i => new MenuItemDto(
            i.Id, i.CategoryId, i.Name, i.Description, i.Price,
            i.PrepTimeMinutes, i.Allergens, i.IsAvailable,
            groupsByItem.TryGetValue(i.Id, out var g) ? g : [], i.KitchenStationId, i.IsOnlineOrderable))
            .ToList();

        return Result.Success<IReadOnlyList<MenuItemDto>>(dtos);
    }
}
