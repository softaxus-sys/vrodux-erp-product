namespace Softaxis.Finance.Domain.Entities;

/// <summary>Daily exchange rate: units of base currency (AED) per 1 unit of CurrencyCode.</summary>
public sealed class ExchangeRate
{
    private ExchangeRate() { }

    public ExchangeRate(string currencyCode, string rateDate, decimal rate)
    {
        Id           = Guid.NewGuid();
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        RateDate     = rateDate;
        Rate         = rate;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public string    CurrencyCode { get; private set; } = string.Empty;
    public string    RateDate     { get; private set; } = string.Empty;
    public decimal   Rate         { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public void Update(decimal rate)
    {
        Rate      = rate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete()
    {
        IsDeleted = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
