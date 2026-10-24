namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// One branch's exception to the shared menu: a different price, or "not sold here". The menu itself
/// stays one list for the whole group; a branch with no row sells every item at its menu price.
/// Pure override row, hard-deleted when cleared (both fields back to the default).
/// </summary>
public sealed class MenuItemBranchSetting
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid MenuItemId { get; private set; }
    public Guid BranchId { get; private set; }

    /// <summary>Null = sell at the menu price.</summary>
    public decimal? PriceOverride { get; private set; }

    /// <summary>False = this branch does not sell the item at all.</summary>
    public bool IsAvailable { get; private set; } = true;

    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    private MenuItemBranchSetting() { }

    public MenuItemBranchSetting(Guid menuItemId, Guid branchId)
    {
        MenuItemId = menuItemId; BranchId = branchId;
    }

    public void Set(decimal? priceOverride, bool isAvailable)
    {
        PriceOverride = priceOverride;
        IsAvailable = isAvailable;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>True when the row says nothing the menu does not already say.</summary>
    public bool IsDefault => PriceOverride is null && IsAvailable;
}
