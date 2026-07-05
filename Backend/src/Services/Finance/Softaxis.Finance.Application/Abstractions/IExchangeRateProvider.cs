namespace Softaxis.Finance.Application.Abstractions;

/// <summary>
/// Fetches live exchange rates from an external source, quoted against USD (the system base).
/// The returned map is <c>currencyCode → units of that currency per 1 USD</c> (e.g. EUR ≈ 0.92).
/// </summary>
public interface IExchangeRateProvider
{
    /// <summary>
    /// Returns code → (units per 1 USD), or an empty map when the source is unreachable
    /// (callers fall back to the seeded rates). Never throws.
    /// </summary>
    Task<IReadOnlyDictionary<string, decimal>> GetUsdRatesAsync(CancellationToken ct = default);
}
