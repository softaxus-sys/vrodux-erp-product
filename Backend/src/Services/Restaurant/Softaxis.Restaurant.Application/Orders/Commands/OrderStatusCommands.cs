using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/send</summary>
public sealed record SendOrderToKitchenCommand(Guid OrderId) : IOrderScopedCommand, ICommand<OrderStatusDto>;

/// <summary>PATCH /api/restaurant/orders/{id}/ready</summary>
public sealed record MarkOrderReadyCommand(Guid OrderId) : IOrderScopedCommand, ICommand<OrderStatusDto>;

/// <summary>PATCH /api/restaurant/orders/{id}/serve</summary>
public sealed record ServeOrderCommand(Guid OrderId) : IOrderScopedCommand, ICommand<OrderStatusDto>;
