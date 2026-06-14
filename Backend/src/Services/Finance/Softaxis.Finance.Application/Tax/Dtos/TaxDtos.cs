namespace Softaxis.Finance.Application.Tax.Dtos;

public sealed record TaxPeriodDto(
    Guid     Id,
    string   Period,
    string   From,
    string   To,
    string   Status,
    decimal  OutputVat,
    decimal  InputVat,
    decimal  NetVat,
    string   DueDate,
    string?  FiledDate,
    string?  PaidDate,
    decimal? Penalty);

public sealed record TaxTransactionDto(
    Guid    Id,
    string  Date,
    string  Type,
    string  Reference,
    decimal Amount,
    decimal VatAmount,
    decimal VatRate,
    string  Description,
    string  Period);

public sealed record TaxSummaryDto(
    decimal CurrentPeriodOutput,
    decimal CurrentPeriodInput,
    decimal CurrentNetVat,
    decimal YtdVatPaid,
    string  NextDueDate,
    string  CurrentPeriod,
    string  RegistrationNumber);
