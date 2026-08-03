using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class CreateMenuCategoryHandler(RestaurantDbContext db)
    : ICommandHandler<CreateMenuCategoryCommand, MenuCategoryDto>
{
    public async Task<Result<MenuCategoryDto>> Handle(CreateMenuCategoryCommand cmd, CancellationToken ct)
    {
        var cat = new Domain.Entities.MenuCategory(cmd.Name.Trim(), cmd.Description, cmd.SortOrder, cmd.KitchenStationId);
        db.MenuCategories.Add(cat);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MenuCategoryDto(
            cat.Id, cat.Name, cat.Description, cat.SortOrder, cat.IsActive, [], cat.KitchenStationId));
    }
}
