namespace Softaxis.Finance.Application.RecurringInvoices.Dtos;

public sealed record LineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice);

public sealed record LineRequest(string Description, decimal Quantity, decimal UnitPrice);

public sealed record RecurringDto(
    Guid Id, string TemplateName, string CustomerName, string? CustomerEmail,
    string Frequency, string StartDate, string? EndDate, string NextRunDate,
    int DueDays, decimal TaxRate, string? Notes, bool IsActive,
    string? LastGeneratedDate, int GeneratedCount,
    decimal SubTotal, decimal Total, IReadOnlyList<LineDto> Lines);

public sealed record RecurringInvoicesSummaryDto(
    int     Total,
    int     Active,
    int     DueSoon,
    int     GeneratedTotal,
    decimal MonthlyValue);

public sealed record GenerateInvoiceResultDto(Guid InvoiceId, string InvoiceNumber);

public sealed record RunDueResultDto(int Generated);
