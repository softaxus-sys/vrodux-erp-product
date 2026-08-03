using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class GetMenuItemModifierGroupsHandler(RestaurantDbContext db)
    : IQueryHandler<GetMenuItemModifierGroupsQuery, IReadOnlyList<Guid>>
{
    public async Task<Result<IReadOnlyList<Guid>>> Handle(GetMenuItemModifierGroupsQuery query, CancellationToken ct)
    {
        var ids = await db.MenuItemModifierGroups.AsNoTracking()
            .Where(l => l.MenuItemId == query.MenuItemId)
            .OrderBy(l => l.SortOrder)
            .Select(l => l.ModifierGroupId)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<Guid>>(ids);
    }
}
