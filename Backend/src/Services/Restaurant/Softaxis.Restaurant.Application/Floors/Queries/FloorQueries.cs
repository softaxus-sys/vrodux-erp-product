using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Floors.Dtos;

namespace Softaxis.Restaurant.Application.Floors.Queries;

/// <summary>GET /api/restaurant/floors — flat list, for dropdowns.</summary>
public sealed record GetFloorsQuery : IQuery<IReadOnlyList<FloorDto>>;

/// <summary>GET /api/restaurant/floors/{floorId}/dining-areas</summary>
public sealed record GetDiningAreasQuery(Guid? FloorId) : IQuery<IReadOnlyList<DiningAreaDto>>;

/// <summary>GET /api/restaurant/floors/layout — full nested tree for the designer canvas.</summary>
public sealed record GetFloorLayoutQuery : IQuery<IReadOnlyList<FloorLayoutDto>>;
