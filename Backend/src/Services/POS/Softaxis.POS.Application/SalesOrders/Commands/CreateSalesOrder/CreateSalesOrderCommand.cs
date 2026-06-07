using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesOrders.Commands.CreateSalesOrder;

public sealed record SalesOrderItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate);

public sealed record CreateSalesOrderCommand(
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ExpectedDate,
    List<SalesOrderItemRequest> Items)
    : ICommand<SalesOrderDto>;
