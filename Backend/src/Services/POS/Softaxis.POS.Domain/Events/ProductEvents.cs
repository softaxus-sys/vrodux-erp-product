using Softaxis.BuildingBlocks.Domain.Events;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Events;

public sealed record ProductCreatedEvent(
    Guid   ProductId,
    string ProductName,
    decimal OpeningStock) : DomainEvent;

public sealed record StockAdjustedEvent(
    Guid                ProductId,
    string              ProductName,
    decimal             QuantityChanged,
    decimal             NewBalance,
    StockAdjustmentType AdjustmentType,
    string?             Reference) : DomainEvent;

public sealed record LowStockAlertEvent(
    Guid    ProductId,
    string  ProductName,
    decimal CurrentStock,
    decimal ReorderLevel) : DomainEvent;
