using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class UpdateMenuCategoryHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateMenuCategoryCommand, MenuCategoryDto>
{
    public async Task<Result<MenuCategoryDto>> Handle(UpdateMenuCategoryCommand cmd, CancellationToken ct)
    {
        var category = await db.MenuCategories.FindAsync([cmd.Id], ct);
        if (category is null || category.IsDeleted)
            return Result.Failure<MenuCategoryDto>(Error.NotFoundById("MenuCategory", cmd.Id));

        category.Update(cmd.Name.Trim(), cmd.Description, cmd.SortOrder);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MenuCategoryDto(
            category.Id, category.Name, category.Description, category.SortOrder,
            category.IsActive, [], category.KitchenStationId));
    }
}
