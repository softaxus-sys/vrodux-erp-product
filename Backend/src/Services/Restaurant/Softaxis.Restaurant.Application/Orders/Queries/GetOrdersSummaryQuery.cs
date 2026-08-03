using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Queries;

/// <summary>GET /api/restaurant/orders/summary</summary>
public sealed record GetOrdersSummaryQuery : IQuery<OrdersSummaryDto>;
