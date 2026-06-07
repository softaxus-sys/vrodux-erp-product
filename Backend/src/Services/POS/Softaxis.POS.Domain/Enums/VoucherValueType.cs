namespace Softaxis.POS.Domain.Enums;

/// <summary>How a voucher's value is interpreted.</summary>
public enum VoucherValueType
{
    /// <summary>Value is a percentage off the cart subtotal (0–100).</summary>
    Percentage  = 1,
    /// <summary>Value is a fixed currency amount off the cart subtotal.</summary>
    FixedAmount = 2,
}
