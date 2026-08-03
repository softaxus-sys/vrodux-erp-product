using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Queries;

/// <summary>GET /api/restaurant/menu/summary</summary>
public sealed record GetMenuSummaryQuery : IQuery<MenuSummaryDto>;
