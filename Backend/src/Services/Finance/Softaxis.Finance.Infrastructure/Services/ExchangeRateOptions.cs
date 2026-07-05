namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>Config for the online exchange-rate provider (bound from the "ExchangeRates" section).</summary>
public sealed class ExchangeRateOptions
{
    public const string Section = "ExchangeRates";

    /// <summary>Provider id. Currently only "er-api" (open.er-api.com) is implemented.</summary>
    public string Provider { get; set; } = "er-api";

    /// <summary>Base URL of the provider. open.er-api.com needs no API key.</summary>
    public string BaseUrl { get; set; } = "https://open.er-api.com/v6";

    /// <summary>Optional API key for keyed providers (appended as ?apikey= when set).</summary>
    public string? ApiKey { get; set; }

    /// <summary>Master switch — set false to run fully offline on the seeded fallback rates.</summary>
    public bool Enabled { get; set; } = true;
}
