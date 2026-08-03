using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Queries;

/// <summary>GET /api/restaurant/orders/{id}</summary>
public sealed record GetOrderByIdQuery(Guid Id) : IQuery<OrderDto>;
