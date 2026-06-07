using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Discount voucher / coupon code redeemable at the POS.
/// Supports percentage or fixed-amount value, a minimum-spend threshold,
/// a maximum-discount cap (for % vouchers), a validity window, and a usage limit.
/// </summary>
public sealed class Voucher : AuditableEntity<Guid>
{
    public string           Code              { get; private set; } = default!;
    public string?          Description       { get; private set; }
    public VoucherValueType ValueType         { get; private set; }
    /// <summary>Percentage (0–100) when ValueType=Percentage, else a currency amount.</summary>
    public decimal          Value             { get; private set; }
    /// <summary>Minimum cart subtotal required to use the voucher. 0 = none.</summary>
    public decimal          MinSpend          { get; private set; }
    /// <summary>Optional cap on the computed discount (mainly for % vouchers). null = no cap.</summary>
    public decimal?         MaxDiscountAmount { get; private set; }
    public DateTime?        ValidFrom         { get; private set; }
    public DateTime?        ValidUntil        { get; private set; }
    /// <summary>Total number of times this voucher may be redeemed. null = unlimited.</summary>
    public int?             UsageLimit        { get; private set; }
    public int              UsageCount        { get; private set; }
    public bool             IsActive          { get; private set; }

    private Voucher() { }

    public static Result<Voucher> Create(
        string code, string? description, VoucherValueType valueType, decimal value,
        decimal minSpend, decimal? maxDiscountAmount,
        DateTime? validFrom, DateTime? validUntil,
        int? usageLimit, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure<Voucher>(Error.Custom("Voucher.CodeRequired", "Voucher code is required."));

        if (value <= 0)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidValue", "Voucher value must be greater than zero."));

        if (valueType == VoucherValueType.Percentage && value > 100)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidPercentage", "Percentage voucher cannot exceed 100%."));

        if (minSpend < 0)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidMinSpend", "Minimum spend cannot be negative."));

        if (maxDiscountAmount is < 0)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidCap", "Maximum discount cap cannot be negative."));

        if (usageLimit is < 1)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidUsageLimit", "Usage limit must be at least 1, or empty for unlimited."));

        if (validFrom.HasValue && validUntil.HasValue && validUntil < validFrom)
            return Result.Failure<Voucher>(Error.Custom("Voucher.InvalidDates", "Valid-until date must be after valid-from date."));

        return Result.Success(new Voucher
        {
            Id                = Guid.NewGuid(),
            Code              = code.Trim().ToUpperInvariant(),
            Description       = description?.Trim(),
            ValueType         = valueType,
            Value             = value,
            MinSpend          = minSpend,
            MaxDiscountAmount = maxDiscountAmount,
            ValidFrom         = validFrom,
            ValidUntil        = validUntil,
            UsageLimit        = usageLimit,
            UsageCount        = 0,
            IsActive          = isActive,
        });
    }

    public Result Update(
        string code, string? description, VoucherValueType valueType, decimal value,
        decimal minSpend, decimal? maxDiscountAmount,
        DateTime? validFrom, DateTime? validUntil,
        int? usageLimit, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Result.Failure(Error.Custom("Voucher.CodeRequired", "Voucher code is required."));
        if (value <= 0)
            return Result.Failure(Error.Custom("Voucher.InvalidValue", "Voucher value must be greater than zero."));
        if (valueType == VoucherValueType.Percentage && value > 100)
            return Result.Failure(Error.Custom("Voucher.InvalidPercentage", "Percentage voucher cannot exceed 100%."));
        if (usageLimit.HasValue && usageLimit.Value < UsageCount)
            return Result.Failure(Error.Custom("Voucher.UsageLimitTooLow",
                $"Usage limit cannot be below the current usage count ({UsageCount})."));

        Code              = code.Trim().ToUpperInvariant();
        Description       = description?.Trim();
        ValueType         = valueType;
        Value             = value;
        MinSpend          = minSpend;
        MaxDiscountAmount = maxDiscountAmount;
        ValidFrom         = validFrom;
        ValidUntil        = validUntil;
        UsageLimit        = usageLimit;
        IsActive          = isActive;
        UpdatedAt         = DateTime.UtcNow;
        return Result.Success();
    }

    /// <summary>Validate the voucher for redemption against a cart subtotal at a point in time.</summary>
    public Result Validate(decimal subtotal, DateTime nowUtc)
    {
        if (!IsActive)
            return Result.Failure(Error.Custom("Voucher.Inactive", "This voucher is not active."));

        if (ValidFrom.HasValue && nowUtc < ValidFrom.Value)
            return Result.Failure(Error.Custom("Voucher.NotStarted",
                $"This voucher is not valid until {ValidFrom.Value:yyyy-MM-dd}."));

        if (ValidUntil.HasValue && nowUtc > ValidUntil.Value)
            return Result.Failure(Error.Custom("Voucher.Expired", "This voucher has expired."));

        if (UsageLimit.HasValue && UsageCount >= UsageLimit.Value)
            return Result.Failure(Error.Custom("Voucher.UsageExhausted", "This voucher has reached its usage limit."));

        if (subtotal < MinSpend)
            return Result.Failure(Error.Custom("Voucher.MinSpend",
                $"A minimum spend of {MinSpend:F2} is required to use this voucher."));

        return Result.Success();
    }

    /// <summary>Compute the discount amount for a given subtotal (does not validate).</summary>
    public decimal ComputeDiscount(decimal subtotal)
    {
        var raw = ValueType == VoucherValueType.Percentage
            ? Math.Round(subtotal * (Value / 100m), 2)
            : Value;

        if (MaxDiscountAmount.HasValue)
            raw = Math.Min(raw, MaxDiscountAmount.Value);

        return Math.Min(raw, subtotal); // never exceed the subtotal
    }

    public void IncrementUsage() => UsageCount++;

    public void Activate()   => IsActive = true;
    public void Deactivate() => IsActive = false;
}
