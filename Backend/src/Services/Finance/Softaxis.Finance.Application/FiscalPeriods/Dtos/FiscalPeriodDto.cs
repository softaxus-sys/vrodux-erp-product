namespace Softaxis.Finance.Application.FiscalPeriods.Dtos;

public sealed record FiscalPeriodDto(
    Guid Id,
    string PeriodCode,
    string Status,
    string? ClosedByName,
    DateTime? ClosedAt);
