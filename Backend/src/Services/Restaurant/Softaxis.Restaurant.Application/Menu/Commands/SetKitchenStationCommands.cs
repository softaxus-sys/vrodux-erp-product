using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>PATCH /api/restaurant/menu/items/{id}/kitchen-station</summary>
public sealed record SetMenuItemKitchenStationCommand(Guid Id, Guid? KitchenStationId) : ICommand<MenuItemDto>;

/// <summary>PATCH /api/restaurant/menu/categories/{id}/kitchen-station — the category's default,
/// overridden per-item by MenuItem.KitchenStationId when set.</summary>
public sealed record SetMenuCategoryKitchenStationCommand(Guid Id, Guid? KitchenStationId) : ICommand<MenuCategoryDto>;
