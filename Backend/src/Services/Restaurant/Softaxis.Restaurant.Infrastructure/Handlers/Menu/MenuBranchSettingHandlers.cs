using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class GetMenuBranchSettingsHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetMenuBranchSettingsQuery, IReadOnlyList<MenuItemBranchSettingDto>>
{
    public async Task<Result<IReadOnlyList<MenuItemBranchSettingDto>>> Handle(GetMenuBranchSettingsQuery query, CancellationToken ct)
    {
        var scope = await branchAccess.ResolveReadScopeAsync(query.BranchId, ct);
        if (scope is { Count: 0 }) return Result.Success<IReadOnlyList<MenuItemBranchSettingDto>>([]);

        var rows = await db.MenuItemBranchSettings.AsNoTracking()
            .Where(s => s.BranchId == query.BranchId)
            .Select(s => new MenuItemBranchSettingDto(s.MenuItemId, s.BranchId, s.PriceOverride, s.IsAvailable))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<MenuItemBranchSettingDto>>(rows);
    }
}

internal sealed class SetMenuItemBranchSettingHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : ICommandHandler<SetMenuItemBranchSettingCommand, MenuItemBranchSettingDto>
{
    public async Task<Result<MenuItemBranchSettingDto>> Handle(SetMenuItemBranchSettingCommand cmd, CancellationToken ct)
    {
        if (!await branchAccess.CanWriteToBranchAsync(cmd.BranchId, ct))
            return Result.Failure<MenuItemBranchSettingDto>(
                Error.Custom("Branch.Forbidden", "You are not assigned to this branch."));

        var item = await db.MenuItems.FirstOrDefaultAsync(x => x.Id == cmd.MenuItemId && !x.IsDeleted, ct);
        if (item is null)
            return Result.Failure<MenuItemBranchSettingDto>(Error.NotFoundById("MenuItem", cmd.MenuItemId));

        var row = await db.MenuItemBranchSettings
            .FirstOrDefaultAsync(s => s.MenuItemId == cmd.MenuItemId && s.BranchId == cmd.BranchId, ct);

        // A price equal to the menu price is not an override; storing it would freeze the branch at
        // today's price when the menu price later changes.
        var price = cmd.PriceOverride == item.Price ? null : cmd.PriceOverride;

        if (row is null)
        {
            row = new MenuItemBranchSetting(cmd.MenuItemId, cmd.BranchId);
            db.MenuItemBranchSettings.Add(row);
        }
        row.Set(price, cmd.IsAvailable);
        if (row.IsDefault) db.MenuItemBranchSettings.Remove(row);

        await db.SaveChangesAsync(ct);
        return Result.Success(new MenuItemBranchSettingDto(row.MenuItemId, row.BranchId, row.PriceOverride, row.IsAvailable));
    }
}
