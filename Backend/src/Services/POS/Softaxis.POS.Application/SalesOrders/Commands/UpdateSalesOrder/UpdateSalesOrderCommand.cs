using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.SalesOrders.Commands.CreateSalesOrder;

namespace Softaxis.POS.Application.SalesOrders.Commands.UpdateSalesOrder;

public sealed record UpdateSalesOrderCommand(
    Guid    Id,
    Guid?   CustomerId,
    string? CustomerName,
    string  Status,
    string? Notes,
    string? ExpectedDate,
    List<SalesOrderItemRequest> Items)
    : ICommand;
