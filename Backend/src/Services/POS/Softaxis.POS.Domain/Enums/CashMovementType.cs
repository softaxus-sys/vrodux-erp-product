namespace Softaxis.POS.Domain.Enums;

/// <summary>Manual cash drawer movement during a shift (not tied to a sale).</summary>
public enum CashMovementType
{
    /// <summary>Cash added to the drawer (e.g. float top-up, owner deposit).</summary>
    PayIn  = 1,
    /// <summary>Cash removed from the drawer (e.g. petty cash, supplier paid in cash, safe drop).</summary>
    PayOut = 2,
}
