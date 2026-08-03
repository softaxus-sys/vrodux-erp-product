using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class AssignMenuItemModifierGroupsHandler(RestaurantDbContext db)
    : ICommandHandler<AssignMenuItemModifierGroupsCommand>
{
    public async Task<Result> Handle(AssignMenuItemModifierGroupsCommand cmd, CancellationToken ct)
    {
        var menuItem = await db.MenuItems.FindAsync([cmd.MenuItemId], ct);
        if (menuItem is null || menuItem.IsDeleted)
            return Result.Failure(Error.NotFoundById("MenuItem", cmd.MenuItemId));

        var existing = await db.MenuItemModifierGroups
            .Where(l => l.MenuItemId == cmd.MenuItemId).ToListAsync(ct);
        db.MenuItemModifierGroups.RemoveRange(existing);

        var sortOrder = 0;
        foreach (var groupId in cmd.ModifierGroupIds)
            db.MenuItemModifierGroups.Add(new MenuItemModifierGroup(cmd.MenuItemId, groupId, sortOrder++));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
