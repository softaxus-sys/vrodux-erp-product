using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>POST /api/restaurant/orders/{id}/transfer-table — moves an in-progress order to a
/// different table (e.g. a guest asks to switch seats), audited via TableTransferLog. Distinct
/// from a table *merge*, which combines seating capacity rather than moving an order.</summary>
public sealed record TransferOrderTableCommand(Guid OrderId, Guid ToTableId) : ICommand<OrderDto>;
