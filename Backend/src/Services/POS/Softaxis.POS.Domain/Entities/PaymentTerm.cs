using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>Payment term definition — master reference table.</summary>
public sealed class PaymentTerm : AuditableEntity<Guid>
{
    public string  Name            { get; private set; } = default!;
    public string  Code            { get; private set; } = default!;
    /// <summary>Payment due within N days of invoice date.</summary>
    public int     DaysNet         { get; private set; }
    /// <summary>Percentage of total required as advance (0 = none).</summary>
    public decimal AdvancePercent  { get; private set; }
    public string? Description     { get; private set; }
    public bool    IsDefault       { get; private set; }
    public bool    IsSystem        { get; private set; }

    private PaymentTerm() { }

    public static Result<PaymentTerm> Create(
        string name, string code, int daysNet, decimal advancePercent,
        string? description, bool isDefault, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<PaymentTerm>(Error.Custom("PaymentTerm.NameRequired", "Name is required."));
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<PaymentTerm>(Error.Custom("PaymentTerm.CodeRequired", "Code is required."));

        return Result.Success(new PaymentTerm
        {
            Id             = Guid.NewGuid(),
            Name           = name.Trim(),
            Code           = code.Trim().ToUpperInvariant(),
            DaysNet        = daysNet,
            AdvancePercent = Math.Clamp(advancePercent, 0, 100),
            Description    = description?.Trim(),
            IsDefault      = isDefault,
            IsSystem       = isSystem,
        });
    }

    public void Update(string name, string code, int daysNet,
        decimal advancePercent, string? description, bool isDefault)
    {
        Name           = name.Trim();
        Code           = code.Trim().ToUpperInvariant();
        DaysNet        = daysNet;
        AdvancePercent = Math.Clamp(advancePercent, 0, 100);
        Description    = description?.Trim();
        IsDefault      = isDefault;
        UpdatedAt      = DateTime.UtcNow;
    }
}
