namespace Softaxis.Finance.Application.Invoices.Dtos;

public sealed record InvoiceItemDto(
    Guid    Id,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record InvoiceItemRequest(
    string  Description,
    decimal Quantity,
    decimal UnitPrice);

public sealed record InvoiceSummaryDto(
    Guid      Id,
    string    InvoiceNumber,
    string    CustomerName,
    string?   CustomerEmail,
    string    InvoiceDate,
    string    DueDate,
    decimal   TaxRate,
    decimal   SubTotal,
    decimal   TaxAmount,
    decimal   Total,
    string    Status,
    int       ItemCount,
    DateTime? PaidAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record InvoiceDto(
    Guid      Id,
    string    InvoiceNumber,
    string    CustomerName,
    string?   CustomerEmail,
    string    InvoiceDate,
    string    DueDate,
    decimal   TaxRate,
    decimal   SubTotal,
    decimal   TaxAmount,
    decimal   Total,
    string    Status,
    string?   Notes,
    string?   CcEmails,
    IReadOnlyList<InvoiceItemDto> Items,
    DateTime? PaidAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record InvoicesSummaryDto(
    int     TotalInvoices,
    decimal TotalAmount,
    decimal TotalPaid,
    decimal TotalOverdue,
    decimal TotalOutstanding,
    int     DraftCount);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
