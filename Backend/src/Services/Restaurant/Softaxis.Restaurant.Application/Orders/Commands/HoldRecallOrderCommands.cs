using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/hold — parks an open order aside without losing its
/// items (e.g. the terminal is needed for something else). Only valid from "open".</summary>
public sealed record HoldOrderCommand(Guid OrderId) : ICommand<OrderStatusDto>;

/// <summary>PATCH /api/restaurant/orders/{id}/recall — resumes a held order. Only valid from "held".</summary>
public sealed record RecallOrderCommand(Guid OrderId) : ICommand<OrderStatusDto>;
