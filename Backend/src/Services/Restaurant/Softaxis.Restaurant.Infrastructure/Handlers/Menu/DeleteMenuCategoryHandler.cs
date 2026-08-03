using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class DeleteMenuCategoryHandler(RestaurantDbContext db)
    : ICommandHandler<DeleteMenuCategoryCommand>
{
    public async Task<Result> Handle(DeleteMenuCategoryCommand cmd, CancellationToken ct)
    {
        var category = await db.MenuCategories.FindAsync([cmd.Id], ct);
        if (category is null || category.IsDeleted)
            return Result.Failure(Error.NotFoundById("MenuCategory", cmd.Id));

        var hasItems = await db.MenuItems.AnyAsync(i => i.CategoryId == cmd.Id && !i.IsDeleted, ct);
        if (hasItems)
            return Result.Failure(Error.Custom("MenuCategory.Conflict",
                "This category still has menu items — delete or move them first."));

        category.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
