namespace Softaxis.Finance.Application.Lookups.Dtos;

public sealed record AccountTypeDto(
    Guid   Id,
    string Code,
    string Name,
    string NormalBalance,
    int    SortOrder);

public sealed record CurrencyDto(
    Guid   Id,
    string Code,
    string Name,
    string Symbol,
    int    DecimalPlaces,
    bool   IsBaseCurrency);
