namespace Softaxis.POS.Application.DTOs;

public sealed record SalesOrderItemDto(
    Guid    Id,
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    decimal LineTotal);

public sealed record SalesOrderDto(
    Guid     Id,
    string   OrderNumber,
    Guid?    CustomerId,
    string?  CustomerName,
    string   Status,
    string?  Notes,
    string?  ExpectedDate,
    string?  DeliveredDate,
    decimal  SubTotal,
    decimal  TaxAmount,
    decimal  Total,
    List<SalesOrderItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record SalesOrderSummaryDto(
    Guid      Id,
    string    OrderNumber,
    Guid?     CustomerId,
    string?   CustomerName,
    string    Status,
    string?   ExpectedDate,
    string?   DeliveredDate,
    decimal   Total,
    int       ItemCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
