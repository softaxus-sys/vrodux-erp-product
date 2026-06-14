using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.ExchangeRates.Dtos;

namespace Softaxis.Finance.Application.ExchangeRates.Queries;

public sealed record GetExchangeRatesQuery(string? CurrencyCode) : IQuery<IReadOnlyList<ExchangeRateDto>>;

/// <summary>Converts an amount from one currency to another using the latest rate on or before AsOf (defaults to today).</summary>
public sealed record ConvertCurrencyQuery(string FromCurrency, string ToCurrency, decimal Amount, string? AsOf) : IQuery<ConvertCurrencyDto>;
