namespace Softaxis.Sales.Application.DeliveryChallans.Dtos;

public sealed record DeliveryChallanItemDto(
    Guid    Id,
    Guid?   SalesOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal OrderedQuantity,
    decimal DeliveredQuantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record DeliveryChallanDto(
    Guid    Id,
    string  ChallanNumber,
    Guid    SalesOrderId,
    string  SalesOrderNumber,
    Guid?   CustomerId,
    string  CustomerName,
    string  ChallanDate,
    string? DriverName,
    string? Notes,
    string  Status,
    IReadOnlyList<DeliveryChallanItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record DeliveryChallanSummaryDto(
    Guid    Id,
    string  ChallanNumber,
    Guid    SalesOrderId,
    string  SalesOrderNumber,
    Guid?   CustomerId,
    string  CustomerName,
    string  ChallanDate,
    string? DriverName,
    string  Status,
    int     ItemCount,
    DateTime CreatedAt);
