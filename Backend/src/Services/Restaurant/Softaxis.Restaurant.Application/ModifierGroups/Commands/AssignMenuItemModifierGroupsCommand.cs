using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.ModifierGroups.Commands;

/// <summary>PUT /api/restaurant/menu/items/{id}/modifier-groups — replaces the full set of
/// modifier groups assigned to a menu item, in the given order.</summary>
public sealed record AssignMenuItemModifierGroupsCommand(Guid MenuItemId, IReadOnlyList<Guid> ModifierGroupIds) : ICommand;
