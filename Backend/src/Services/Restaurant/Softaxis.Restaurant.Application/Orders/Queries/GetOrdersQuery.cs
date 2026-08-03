using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Queries;

/// <summary>GET /api/restaurant/orders?status=</summary>
public sealed record GetOrdersQuery(string? Status) : IQuery<IReadOnlyList<OrderDto>>;
