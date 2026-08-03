using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Queries;

/// <summary>GET /api/restaurant/menu/items?categoryId=</summary>
public sealed record GetMenuItemsQuery(Guid? CategoryId) : IQuery<IReadOnlyList<MenuItemDto>>;
