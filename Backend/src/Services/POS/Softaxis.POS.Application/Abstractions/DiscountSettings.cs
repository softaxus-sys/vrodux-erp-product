namespace Softaxis.POS.Application.Abstractions;

/// <summary>
/// Configurable discount policy, bound from appsettings.json "DiscountSettings".
/// </summary>
public sealed class DiscountSettings
{
    /// <summary>Maximum manual (percentage/fixed) discount as a % of subtotal. Default 100 (no cap).</summary>
    public decimal MaxDiscountPercent { get; set; } = 100m;

    /// <summary>Currency value of one loyalty point when redeemed. Default 1.0.</summary>
    public decimal LoyaltyPointValue { get; set; } = 1.0m;
}
