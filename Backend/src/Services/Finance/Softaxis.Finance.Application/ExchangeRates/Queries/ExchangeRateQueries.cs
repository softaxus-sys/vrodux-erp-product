using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.ExchangeRates.Dtos;

namespace Softaxis.Finance.Application.ExchangeRates.Queries;

/// <param name="LatestOnly">
/// One row per currency — its newest rate. This table grows by one row per currency per day
/// (the refresh service runs daily), so the full history is unbounded; the only screen that reads
/// it reduces to exactly this, and did so in the browser after fetching everything.
/// </param>
public sealed record GetExchangeRatesQuery(
    string? CurrencyCode,
    bool    LatestOnly = false) : IQuery<IReadOnlyList<ExchangeRateDto>>;

/// <summary>Converts an amount from one currency to another using the latest rate on or before AsOf (defaults to today).</summary>
public sealed record ConvertCurrencyQuery(string FromCurrency, string ToCurrency, decimal Amount, string? AsOf) : IQuery<ConvertCurrencyDto>;
