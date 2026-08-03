using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.ModifierGroups.Queries;

/// <summary>GET /api/restaurant/menu/items/{id}/modifier-groups — the modifier group ids currently
/// assigned to a menu item (for the assignment-editor UI).</summary>
public sealed record GetMenuItemModifierGroupsQuery(Guid MenuItemId) : IQuery<IReadOnlyList<Guid>>;
