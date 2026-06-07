using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>Customer tier / loyalty group — master reference table.</summary>
public sealed class CustomerGroup : AuditableEntity<Guid>
{
    public string  Name            { get; private set; } = default!;
    public string  Code            { get; private set; } = default!;
    /// <summary>Blanket discount % for all members of this group.</summary>
    public decimal DiscountPercent { get; private set; }
    /// <summary>Minimum lifetime purchase to qualify (0 = open).</summary>
    public decimal MinPurchase     { get; private set; }
    public string? Description     { get; private set; }
    public bool    IsDefault       { get; private set; }
    public bool    IsActive        { get; private set; }
    public bool    IsSystem        { get; private set; }

    private CustomerGroup() { }

    public static Result<CustomerGroup> Create(
        string name, string code, decimal discountPercent, decimal minPurchase,
        string? description, bool isDefault, bool isActive, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<CustomerGroup>(Error.Custom("CustomerGroup.NameRequired", "Name is required."));
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<CustomerGroup>(Error.Custom("CustomerGroup.CodeRequired", "Code is required."));

        return Result.Success(new CustomerGroup
        {
            Id              = Guid.NewGuid(),
            Name            = name.Trim(),
            Code            = code.Trim().ToUpperInvariant(),
            DiscountPercent = Math.Clamp(discountPercent, 0, 100),
            MinPurchase     = Math.Max(0, minPurchase),
            Description     = description?.Trim(),
            IsDefault       = isDefault,
            IsActive        = isActive,
            IsSystem        = isSystem,
        });
    }

    public void Update(string name, string code, decimal discountPercent,
        decimal minPurchase, string? description, bool isDefault, bool isActive)
    {
        Name            = name.Trim();
        Code            = code.Trim().ToUpperInvariant();
        DiscountPercent = Math.Clamp(discountPercent, 0, 100);
        MinPurchase     = Math.Max(0, minPurchase);
        Description     = description?.Trim();
        IsDefault       = isDefault;
        IsActive        = isActive;
        UpdatedAt       = DateTime.UtcNow;
    }
}
