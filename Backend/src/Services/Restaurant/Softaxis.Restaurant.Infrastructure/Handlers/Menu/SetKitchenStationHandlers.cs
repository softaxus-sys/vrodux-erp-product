using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class SetMenuItemKitchenStationHandler(RestaurantDbContext db)
    : ICommandHandler<SetMenuItemKitchenStationCommand, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> Handle(SetMenuItemKitchenStationCommand cmd, CancellationToken ct)
    {
        var item = await db.MenuItems.FindAsync([cmd.Id], ct);
        if (item is null || item.IsDeleted)
            return Result.Failure<MenuItemDto>(Error.NotFoundById("MenuItem", cmd.Id));

        item.SetKitchenStation(cmd.KitchenStationId);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MenuItemDto(
            item.Id, item.CategoryId, item.Name, item.Description, item.Price,
            item.PrepTimeMinutes, item.Allergens, item.IsAvailable, [], item.KitchenStationId,
            item.IsOnlineOrderable));
    }
}

internal sealed class SetMenuCategoryKitchenStationHandler(RestaurantDbContext db)
    : ICommandHandler<SetMenuCategoryKitchenStationCommand, MenuCategoryDto>
{
    public async Task<Result<MenuCategoryDto>> Handle(SetMenuCategoryKitchenStationCommand cmd, CancellationToken ct)
    {
        var cat = await db.MenuCategories.FindAsync([cmd.Id], ct);
        if (cat is null || cat.IsDeleted)
            return Result.Failure<MenuCategoryDto>(Error.NotFoundById("MenuCategory", cmd.Id));

        cat.SetKitchenStation(cmd.KitchenStationId);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MenuCategoryDto(
            cat.Id, cat.Name, cat.Description, cat.SortOrder, cat.IsActive, [], cat.KitchenStationId));
    }
}
