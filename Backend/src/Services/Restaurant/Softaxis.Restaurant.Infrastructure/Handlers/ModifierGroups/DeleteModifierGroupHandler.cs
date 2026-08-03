using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class DeleteModifierGroupHandler(RestaurantDbContext db)
    : ICommandHandler<DeleteModifierGroupCommand>
{
    public async Task<Result> Handle(DeleteModifierGroupCommand cmd, CancellationToken ct)
    {
        var group = await db.ModifierGroups.FindAsync([cmd.Id], ct);
        if (group is null || group.IsDeleted)
            return Result.Failure(Error.NotFoundById("ModifierGroup", cmd.Id));

        group.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
