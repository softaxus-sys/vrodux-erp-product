using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.Finance.Application.Abstractions;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Exchange-rate provider backed by open.er-api.com (free, no API key). Response shape:
/// <c>{ "result":"success", "base_code":"USD", "rates": { "EUR":0.92, "PKR":278.5, ... } }</c>
/// where each value is units of that currency per 1 USD. Read-as-string + JsonDocument to
/// avoid extra serialization deps. Never throws — returns an empty map on any failure so
/// callers fall back to the seeded rates.
/// </summary>
public sealed class ErApiExchangeRateProvider(
    IHttpClientFactory httpFactory,
    IOptions<ExchangeRateOptions> options,
    ILogger<ErApiExchangeRateProvider> logger) : IExchangeRateProvider
{
    private readonly ExchangeRateOptions _o = options.Value;

    public async Task<IReadOnlyDictionary<string, decimal>> GetUsdRatesAsync(CancellationToken ct = default)
    {
        if (!_o.Enabled)
            return new Dictionary<string, decimal>();

        try
        {
            var url = $"{_o.BaseUrl.TrimEnd('/')}/latest/USD";
            if (!string.IsNullOrWhiteSpace(_o.ApiKey))
                url += $"?apikey={Uri.EscapeDataString(_o.ApiKey)}";

            var client = httpFactory.CreateClient("exchange-rates");
            client.Timeout = TimeSpan.FromSeconds(15);

            using var resp = await client.GetAsync(url, ct);
            resp.EnsureSuccessStatusCode();

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

            if (!root.TryGetProperty("rates", out var rates) || rates.ValueKind != JsonValueKind.Object)
            {
                logger.LogWarning("ExchangeRates: provider response had no 'rates' object.");
                return new Dictionary<string, decimal>();
            }

            var map = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in rates.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDecimal(out var v) && v > 0)
                    map[prop.Name.ToUpperInvariant()] = v;
            }
            return map;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "ExchangeRates: failed to fetch live rates — falling back to seeded rates.");
            return new Dictionary<string, decimal>();
        }
    }
}
