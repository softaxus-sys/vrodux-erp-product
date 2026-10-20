namespace Softaxis.Finance.Application.Invoices.Dtos;

public sealed record InvoiceItemDto(
    Guid    Id,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? TaxCategory     = null,
    string? UnitCode        = null,
    string? ExemptionReason = null);

public sealed record InvoiceItemRequest(
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    /// <summary>S standard (default), Z zero-rated, E exempt, O out of scope.</summary>
    string? TaxCategory     = null,
    /// <summary>UN/ECE Rec 20 unit code, e.g. C62, H87, HUR.</summary>
    string? UnitCode        = null,
    /// <summary>Why a non-standard line carries no VAT.</summary>
    string? ExemptionReason = null);

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
    /// <summary>The currency this invoice is recorded in. The emailed PDF renders it, so the UI must
    /// show the same one rather than the tenant current operating currency.</summary>
    string    CurrencyCode,
    string    Status,
    string?   ScheduledSendDate,
    // Carried on the list DTO too: the edit form initialises from it, and defaulting to true there
    // would silently switch reminders back on for an invoice someone had deliberately opted out.
    bool      RemindBeforeDue,
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
    /// <summary>The currency this invoice is recorded in. The emailed PDF renders it, so the UI must
    /// show the same one rather than the tenant current operating currency.</summary>
    string    CurrencyCode,
    string    Status,
    string?   Notes,
    string?   CcEmails,
    /// <summary>Pending automatic send, or null. Cleared once the invoice goes out.</summary>
    string?   ScheduledSendDate,
    bool      RemindBeforeDue,
    /// <summary>When the last due-date reminder actually left.</summary>
    DateTime? LastReminderSentAt,
    IReadOnlyList<InvoiceItemDto> Items,
    DateTime? PaidAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt,
    string?   CustomerAddress = null,
    string?   CustomerTrn = null);

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
