using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

/// <summary>
/// Loads the modifier groups assigned to a batch of menu items in 3 queries total (not N+1) —
/// used by the Menu queries so the order-taking picker gets everything it needs in one menu fetch.
/// </summary>
internal static class ModifierGroupLookup
{
    public static async Task<Dictionary<Guid, List<ModifierGroupDto>>> GetGroupsForItemsAsync(
        RestaurantDbContext db, IReadOnlyCollection<Guid> menuItemIds, CancellationToken ct)
    {
        if (menuItemIds.Count == 0) return [];

        var links = await db.MenuItemModifierGroups.AsNoTracking()
            .Where(l => menuItemIds.Contains(l.MenuItemId))
            .OrderBy(l => l.SortOrder)
            .ToListAsync(ct);
        if (links.Count == 0) return [];

        var groupIds = links.Select(l => l.ModifierGroupId).Distinct().ToList();
        var groups = await db.ModifierGroups.AsNoTracking().Include(g => g.Modifiers)
            .Where(g => groupIds.Contains(g.Id) && !g.IsDeleted)
            .ToListAsync(ct);
        var groupById = groups.ToDictionary(g => g.Id);

        var result = new Dictionary<Guid, List<ModifierGroupDto>>();
        foreach (var link in links)
        {
            if (!groupById.TryGetValue(link.ModifierGroupId, out var g)) continue;
            if (!result.TryGetValue(link.MenuItemId, out var list))
                result[link.MenuItemId] = list = [];
            list.Add(ModifierGroupMappings.ToDto(g));
        }
        return result;
    }
}
