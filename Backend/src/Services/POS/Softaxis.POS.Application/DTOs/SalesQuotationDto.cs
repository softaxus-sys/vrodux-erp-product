namespace Softaxis.POS.Application.DTOs;

public sealed record SalesQuotationItemDto(
    Guid    Id,
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    decimal LineTotal);

public sealed record SalesQuotationDto(
    Guid     Id,
    string   QuotationNumber,
    Guid?    CustomerId,
    string?  CustomerName,
    string   Status,
    string?  Notes,
    string?  ValidUntil,
    decimal  SubTotal,
    decimal  TaxAmount,
    decimal  Total,
    List<SalesQuotationItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record SalesQuotationSummaryDto(
    Guid      Id,
    string    QuotationNumber,
    Guid?     CustomerId,
    string?   CustomerName,
    string    Status,
    string?   ValidUntil,
    decimal   Total,
    int       ItemCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
