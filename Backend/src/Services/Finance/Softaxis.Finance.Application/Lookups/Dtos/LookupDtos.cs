namespace Softaxis.Finance.Application.Lookups.Dtos;

public sealed record AccountTypeDto(
    Guid   Id,
    string Code,
    string Name,
    string NormalBalance,
    Guid?  ParentId,
    int    SortOrder,
    bool   IsActive);

public sealed record CurrencyDto(
    Guid   Id,
    string Code,
    string Name,
    string Symbol,
    int    DecimalPlaces,
    bool   IsBaseCurrency);
