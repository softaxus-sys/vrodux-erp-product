using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class GetMenuHandler(RestaurantDbContext db)
    : IQueryHandler<GetMenuQuery, IReadOnlyList<MenuCategoryDto>>
{
    public async Task<Result<IReadOnlyList<MenuCategoryDto>>> Handle(GetMenuQuery query, CancellationToken ct)
    {
        var cats = await db.MenuCategories.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderBy(x => x.SortOrder).ToListAsync(ct);

        var itemIds = cats.SelectMany(c => c.Items).Where(i => !i.IsDeleted).Select(i => i.Id).ToList();
        var groupsByItem = await ModifierGroupLookup.GetGroupsForItemsAsync(db, itemIds, ct);
        static IReadOnlyList<ModifierGroupDto> GroupsFor(Dictionary<Guid, List<ModifierGroupDto>> map, Guid itemId) =>
            map.TryGetValue(itemId, out var g) ? g : [];

        var dtos = cats.Select(c => new MenuCategoryDto(
            c.Id, c.Name, c.Description, c.SortOrder, c.IsActive,
            c.Items.Where(i => !i.IsDeleted).Select(i => new MenuItemDto(
                i.Id, i.CategoryId, i.Name, i.Description, i.Price,
                i.PrepTimeMinutes, i.Allergens, i.IsAvailable, GroupsFor(groupsByItem, i.Id), i.KitchenStationId,
                i.IsOnlineOrderable)).ToList(),
            c.KitchenStationId))
            .ToList();

        return Result.Success<IReadOnlyList<MenuCategoryDto>>(dtos);
    }
}
