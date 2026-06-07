using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>Tax/VAT rate entry — master reference table.</summary>
public sealed class TaxRate : AuditableEntity<Guid>
{
    public string  Name        { get; private set; } = default!;
    public string  Code        { get; private set; } = default!;
    /// <summary>Percentage value, e.g. 17.00 means 17%.</summary>
    public decimal Rate        { get; private set; }
    /// <summary>"all" | "goods" | "services"</summary>
    public string  AppliesTo   { get; private set; } = "all";
    public string? Description { get; private set; }
    public bool    IsDefault   { get; private set; }
    public bool    IsActive    { get; private set; }
    public bool    IsSystem    { get; private set; }

    private TaxRate() { }

    public static Result<TaxRate> Create(
        string name, string code, decimal rate, string appliesTo,
        string? description, bool isDefault, bool isActive, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<TaxRate>(Error.Custom("TaxRate.NameRequired", "Name is required."));
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<TaxRate>(Error.Custom("TaxRate.CodeRequired", "Code is required."));

        return Result.Success(new TaxRate
        {
            Id          = Guid.NewGuid(),
            Name        = name.Trim(),
            Code        = code.Trim().ToUpperInvariant(),
            Rate        = rate,
            AppliesTo   = appliesTo.Trim().ToLowerInvariant(),
            Description = description?.Trim(),
            IsDefault   = isDefault,
            IsActive    = isActive,
            IsSystem    = isSystem,
        });
    }

    public void Update(string name, string code, decimal rate, string appliesTo,
        string? description, bool isDefault, bool isActive)
    {
        Name        = name.Trim();
        Code        = code.Trim().ToUpperInvariant();
        Rate        = rate;
        AppliesTo   = appliesTo.Trim().ToLowerInvariant();
        Description = description?.Trim();
        IsDefault   = isDefault;
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }
}
