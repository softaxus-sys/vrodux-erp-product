using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>ISO currency entry — master reference table.</summary>
public sealed class Currency : AuditableEntity<Guid>
{
    public string  Code         { get; private set; } = default!;
    public string  Name         { get; private set; } = default!;
    public string  Symbol       { get; private set; } = default!;
    public decimal ExchangeRate { get; private set; }
    public bool    IsDefault    { get; private set; }
    public bool    IsActive     { get; private set; }
    public bool    IsSystem     { get; private set; }

    private Currency() { }

    public static Result<Currency> Create(
        string code, string name, string symbol,
        decimal exchangeRate, bool isDefault, bool isActive, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<Currency>(Error.Custom("Currency.CodeRequired", "Code is required."));
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Currency>(Error.Custom("Currency.NameRequired", "Name is required."));

        return Result.Success(new Currency
        {
            Id           = Guid.NewGuid(),
            Code         = code.Trim().ToUpperInvariant(),
            Name         = name.Trim(),
            Symbol       = symbol.Trim(),
            ExchangeRate = exchangeRate,
            IsDefault    = isDefault,
            IsActive     = isActive,
            IsSystem     = isSystem,
        });
    }

    public void Update(string code, string name, string symbol,
        decimal exchangeRate, bool isDefault, bool isActive)
    {
        Code         = code.Trim().ToUpperInvariant();
        Name         = name.Trim();
        Symbol       = symbol.Trim();
        ExchangeRate = exchangeRate;
        IsDefault    = isDefault;
        IsActive     = isActive;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void SetDefault(bool value) => IsDefault = value;
}
