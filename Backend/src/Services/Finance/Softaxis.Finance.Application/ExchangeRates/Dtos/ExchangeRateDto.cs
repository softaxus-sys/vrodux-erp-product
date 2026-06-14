namespace Softaxis.Finance.Application.ExchangeRates.Dtos;

public sealed record ExchangeRateDto(
    Guid Id,
    string CurrencyCode,
    string RateDate,
    decimal Rate,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ConvertCurrencyDto(
    string FromCurrency,
    string ToCurrency,
    string RateDate,
    decimal Rate,
    decimal Amount,
    decimal ConvertedAmount);
