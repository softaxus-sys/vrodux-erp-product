using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class CreateMenuItemHandler(RestaurantDbContext db)
    : ICommandHandler<CreateMenuItemCommand, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> Handle(CreateMenuItemCommand cmd, CancellationToken ct)
    {
        var catExists = await db.MenuCategories.AnyAsync(c => c.Id == cmd.CategoryId && !c.IsDeleted, ct);
        if (!catExists)
            return Result.Failure<MenuItemDto>(Error.NotFoundById("MenuCategory", cmd.CategoryId));

        var item = new Domain.Entities.MenuItem(
            cmd.CategoryId, cmd.Name.Trim(), cmd.Description, cmd.Price, cmd.PrepTimeMinutes, cmd.Allergens, cmd.KitchenStationId);
        db.MenuItems.Add(item);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MenuItemDto(
            item.Id, item.CategoryId, item.Name, item.Description, item.Price,
            item.PrepTimeMinutes, item.Allergens, item.IsAvailable, [], item.KitchenStationId,
            item.IsOnlineOrderable));
    }
}
