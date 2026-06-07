namespace Softaxis.POS.Application.DTOs;

public sealed record VendorDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string    Category,
    string?   ContactPerson,
    string?   Email,
    string?   Phone,
    string?   Address,
    string?   TaxNumber,
    string    PaymentTerms,
    string    Currency,
    string?   Notes,
    string    Status,
    decimal   Rating,
    int       PurchaseOrderCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record VendorSummaryDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string    Category,
    string?   ContactPerson,
    string?   Email,
    string?   Phone,
    string    Status,
    decimal   Rating,
    int       PurchaseOrderCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
