namespace Softaxis.Inventory.Domain.Constants;

/// <summary>
/// String constants for stock movement types.
/// Stored as VARCHAR in DB — no migration needed when adding new types.
/// </summary>
public static class MovementTypes
{
    public const string Receipt    = "Receipt";    // Goods received (purchase/GRN)
    public const string Sale       = "Sale";       // Stock sold / issued
    public const string Adjustment = "Adjustment"; // Manual stock correction
    public const string Transfer   = "Transfer";   // Moved between warehouses
    public const string WriteOff   = "WriteOff";   // Damaged / expired
    public const string Return     = "Return";     // Customer return / supplier return

    public static readonly IReadOnlyList<string> All =
    [
        Receipt, Sale, Adjustment, Transfer, WriteOff, Return
    ];

    public static bool IsValid(string value) =>
        All.Contains(value, StringComparer.OrdinalIgnoreCase);
}
