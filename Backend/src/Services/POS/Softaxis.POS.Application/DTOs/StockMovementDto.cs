namespace Softaxis.POS.Application.DTOs;

public sealed record POSStockMovementDto(
    Guid     Id,
    Guid     ProductId,
    string   ProductName,
    string?  ProductSku,
    string   AdjustmentType,
    decimal  Quantity,
    decimal  BalanceAfter,
    string?  Reference,
    string?  Notes,
    DateTime CreatedAt);
