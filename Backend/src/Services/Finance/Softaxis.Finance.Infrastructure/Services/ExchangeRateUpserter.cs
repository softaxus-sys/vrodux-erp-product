using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Fetches live USD-quoted rates and upserts today's <see cref="ExchangeRate"/> rows in the
/// system convention: <c>Rate = units of USD per 1 unit of currencyCode</c> (base-per-unit),
/// which is <c>1 / (units per USD)</c>. Only currencies present in the Currencies master are
/// stored. Shared by the daily background job and the manual "Refresh now" endpoint.
/// </summary>
public static class ExchangeRateUpserter
{
    /// <summary>Refreshes rates from the provider. Returns (updated count, asOf date) or (0, today) when offline.</summary>
    public static async Task<(int Updated, string AsOf)> RefreshAsync(
        FinanceDbContext db, IExchangeRateProvider provider, CancellationToken ct)
    {
        var asOf = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var usdRates = await provider.GetUsdRatesAsync(ct);   // code → units per 1 USD
        if (usdRates.Count == 0) return (0, asOf);

        // Only keep currencies we actually support (in the master), excluding the USD base itself.
        var supported = await db.Currencies.AsNoTracking()
            .Where(c => c.Code != "USD")
            .Select(c => c.Code)
            .ToListAsync(ct);

        // Existing rows for today (incl. soft-deleted, to respect the unique (Code, Date) index).
        var todays = await db.ExchangeRates.IgnoreQueryFilters()
            .Where(r => r.RateDate == asOf)
            .ToListAsync(ct);
        var byCode = todays.ToDictionary(r => r.CurrencyCode, StringComparer.OrdinalIgnoreCase);

        var updated = 0;
        foreach (var code in supported)
        {
            if (!usdRates.TryGetValue(code, out var unitsPerUsd) || unitsPerUsd <= 0) continue;
            var rate = Math.Round(1m / unitsPerUsd, 6, MidpointRounding.AwayFromZero);

            if (byCode.TryGetValue(code, out var existing))
                existing.Update(rate);                // revive-in-place (Update clears nothing but Rate/UpdatedAt)
            else
                db.ExchangeRates.Add(new ExchangeRate(code, asOf, rate));
            updated++;
        }

        if (updated > 0) await db.SaveChangesAsync(ct);
        return (updated, asOf);
    }
}
