using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Queries;

/// <summary>GET /api/restaurant/menu — categories with their items, nested.</summary>
public sealed record GetMenuQuery : IQuery<IReadOnlyList<MenuCategoryDto>>;
