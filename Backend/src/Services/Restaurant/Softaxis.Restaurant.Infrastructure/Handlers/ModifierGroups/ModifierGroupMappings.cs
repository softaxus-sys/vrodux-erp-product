using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal static class ModifierGroupMappings
{
    public static ModifierGroupDto ToDto(ModifierGroup g) => new(
        g.Id, g.Name, g.MinSelect, g.MaxSelect,
        g.Modifiers.Where(m => !m.IsDeleted).OrderBy(m => m.SortOrder)
            .Select(m => new ModifierDto(m.Id, m.Name, m.PriceDelta, m.SortOrder, m.IsActive))
            .ToList());
}
