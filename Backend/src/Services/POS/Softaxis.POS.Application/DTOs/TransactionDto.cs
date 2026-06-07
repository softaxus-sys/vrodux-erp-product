namespace Softaxis.POS.Application.DTOs;

public sealed record POSTransactionDto(
    Guid     Id,
    string   TransactionNumber,
    Guid     SessionId,
    Guid     CashierId,
    Guid?    CustomerId,
    string?  CustomerName,
    string   Type,
    string   Status,
    Guid?    OriginalTxnId,
    decimal  SubTotal,
    decimal  TaxAmount,
    decimal  DiscountAmount,
    decimal  TotalAmount,
    decimal  AmountPaid,
    decimal  ChangeGiven,
    string?  Notes,
    DateTime CompletedAt,
    IReadOnlyList<POSLineItemDto> LineItems,
    IReadOnlyList<POSPaymentDto>  Payments);

public sealed record POSTransactionSummaryDto(
    Guid     Id,
    string   TransactionNumber,
    string?  CustomerName,
    string   Type,
    string   Status,
    decimal  TotalAmount,
    string   PrimaryPaymentMethod,
    DateTime CompletedAt);

public sealed record POSLineItemDto(
    Guid    Id,
    Guid    ProductId,
    string  ProductName,
    string? ProductSKU,
    string? ProductBarcode,
    decimal UnitPrice,
    decimal Quantity,
    decimal DiscountPercent,
    decimal DiscountAmount,
    decimal TaxRate,
    decimal TaxAmount,
    decimal LineTotal,
    string  Unit);

public sealed record POSPaymentDto(
    Guid    Id,
    string  Method,
    decimal Amount,
    string? Reference);

public sealed record HeldTransactionDto(
    Guid     Id,
    Guid     SessionId,
    string   Label,
    string   ItemsJson,
    Guid?    CustomerId,
    DateTime HeldAt);

// Request DTOs used in commands
public sealed record LineItemRequest(
    Guid    ProductId,
    decimal Quantity,
    decimal? UnitPriceOverride,
    decimal DiscountPercent,
    decimal DiscountAmount);

public sealed record PaymentRequest(
    string  Method,
    decimal Amount,
    string? Reference);
