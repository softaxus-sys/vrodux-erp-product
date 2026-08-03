using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class DeleteMenuItemHandler(RestaurantDbContext db)
    : ICommandHandler<DeleteMenuItemCommand>
{
    public async Task<Result> Handle(DeleteMenuItemCommand cmd, CancellationToken ct)
    {
        var item = await db.MenuItems.FindAsync([cmd.Id], ct);
        if (item is null || item.IsDeleted)
            return Result.Failure(Error.NotFoundById("MenuItem", cmd.Id));

        item.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
