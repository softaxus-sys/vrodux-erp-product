using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Tables.Dtos;

namespace Softaxis.Restaurant.Application.Tables.Queries;

/// <summary>GET /api/restaurant/tables</summary>
public sealed record GetTablesQuery : IQuery<IReadOnlyList<TableDto>>;
