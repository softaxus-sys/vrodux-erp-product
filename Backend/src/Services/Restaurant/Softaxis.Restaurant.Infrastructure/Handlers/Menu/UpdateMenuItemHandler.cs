using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class UpdateMenuItemHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateMenuItemCommand, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> Handle(UpdateMenuItemCommand cmd, CancellationToken ct)
    {
        var item = await db.MenuItems.FindAsync([cmd.Id], ct);
        if (item is null || item.IsDeleted)
            return Result.Failure<MenuItemDto>(Error.NotFoundById("MenuItem", cmd.Id));

        item.Update(cmd.Name.Trim(), cmd.Description, cmd.Price, cmd.PrepTimeMinutes, cmd.Allergens);
        item.SetOnlineOrderable(cmd.IsOnlineOrderable);
        await db.SaveChangesAsync(ct);

        var groups = await ModifierGroupLookup.GetGroupsForItemsAsync(db, [item.Id], ct);

        return Result.Success(new MenuItemDto(
            item.Id, item.CategoryId, item.Name, item.Description, item.Price,
            item.PrepTimeMinutes, item.Allergens, item.IsAvailable,
            groups.TryGetValue(item.Id, out var g) ? g : [], item.KitchenStationId, item.IsOnlineOrderable));
    }
}
