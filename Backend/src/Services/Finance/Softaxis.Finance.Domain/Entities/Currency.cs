namespace Softaxis.Finance.Domain.Entities;

/// <summary>Currency master — drives decimal precision and symbol for display/rounding.</summary>
public sealed class Currency
{
    private Currency() { }

    public Currency(string code, string name, string symbol, int decimalPlaces, bool isBaseCurrency = false)
    {
        Id             = Guid.NewGuid();
        Code           = code.Trim().ToUpperInvariant();
        Name           = name.Trim();
        Symbol         = symbol.Trim();
        DecimalPlaces  = decimalPlaces;
        IsBaseCurrency = isBaseCurrency;
        IsActive       = true;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    public string    Code           { get; private set; } = string.Empty;
    public string    Name           { get; private set; } = string.Empty;
    public string    Symbol         { get; private set; } = string.Empty;
    public int       DecimalPlaces  { get; private set; }
    public bool      IsBaseCurrency { get; private set; }
    public bool      IsActive       { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
}
