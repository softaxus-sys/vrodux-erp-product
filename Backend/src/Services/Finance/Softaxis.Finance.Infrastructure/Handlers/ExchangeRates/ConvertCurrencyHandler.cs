using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ExchangeRates.Dtos;
using Softaxis.Finance.Application.ExchangeRates.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class ConvertCurrencyHandler(FinanceDbContext db)
    : IQueryHandler<ConvertCurrencyQuery, ConvertCurrencyDto>
{
    public async Task<Result<ConvertCurrencyDto>> Handle(ConvertCurrencyQuery query, CancellationToken ct)
    {
        var fromCode = query.FromCurrency.Trim().ToUpperInvariant();
        var toCode   = query.ToCurrency.Trim().ToUpperInvariant();
        var asOf     = DateOnly.TryParse(query.AsOf, out var parsed) ? parsed : DateOnly.FromDateTime(DateTime.UtcNow);
        var asOfStr  = asOf.ToString("yyyy-MM-dd");

        var baseCurrency = await db.Currencies.AsNoTracking().FirstOrDefaultAsync(x => x.IsBaseCurrency, ct);
        if (baseCurrency is null)
            return Result.Failure<ConvertCurrencyDto>(Error.Custom("ExchangeRate.NoBaseCurrency", "No base currency is configured."));

        var fromRate = await GetRateToBaseAsync(fromCode, baseCurrency.Code, asOfStr, ct);
        if (fromRate is null)
            return Result.Failure<ConvertCurrencyDto>(Error.Custom("ExchangeRate.NotFound", $"No exchange rate found for '{fromCode}' on or before {asOfStr}."));

        var toRate = await GetRateToBaseAsync(toCode, baseCurrency.Code, asOfStr, ct);
        if (toRate is null)
            return Result.Failure<ConvertCurrencyDto>(Error.Custom("ExchangeRate.NotFound", $"No exchange rate found for '{toCode}' on or before {asOfStr}."));

        var crossRate = fromRate.Value / toRate.Value;
        var converted = Math.Round(query.Amount * crossRate, 2);

        return Result.Success(new ConvertCurrencyDto(fromCode, toCode, asOfStr, crossRate, query.Amount, converted));
    }

    private async Task<decimal?> GetRateToBaseAsync(string currencyCode, string baseCurrencyCode, string asOf, CancellationToken ct)
    {
        if (currencyCode == baseCurrencyCode)
            return 1m;

        var rates = await db.ExchangeRates.AsNoTracking()
            .Where(x => x.CurrencyCode == currencyCode)
            .ToListAsync(ct);

        var rate = rates
            .Where(x => string.CompareOrdinal(x.RateDate, asOf) <= 0)
            .OrderByDescending(x => x.RateDate, StringComparer.Ordinal)
            .FirstOrDefault();

        return rate?.Rate;
    }
}
