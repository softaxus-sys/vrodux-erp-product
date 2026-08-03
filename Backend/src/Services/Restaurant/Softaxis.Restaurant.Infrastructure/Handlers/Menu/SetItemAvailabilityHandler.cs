using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class SetItemAvailabilityHandler(RestaurantDbContext db)
    : ICommandHandler<SetItemAvailabilityCommand, ItemAvailabilityDto>
{
    public async Task<Result<ItemAvailabilityDto>> Handle(SetItemAvailabilityCommand cmd, CancellationToken ct)
    {
        var item = await db.MenuItems.FindAsync([cmd.Id], ct);
        if (item is null || item.IsDeleted)
            return Result.Failure<ItemAvailabilityDto>(Error.NotFoundById("MenuItem", cmd.Id));

        item.SetAvailability(cmd.IsAvailable);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ItemAvailabilityDto(item.Id, item.IsAvailable));
    }
}
