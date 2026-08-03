namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// A named set of priced options a menu item can be customized with (e.g. "Size": Small/Medium/Large,
/// "Extras": Cheese/Bacon/Avocado). MinSelect/MaxSelect describe the selection cardinality —
/// MinSelect = 0 means optional, MinSelect >= 1 makes the group required. One group can be assigned to
/// many menu items via MenuItemModifierGroup.
/// </summary>
public sealed class ModifierGroup
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = null!;
    public int MinSelect { get; private set; }
    public int MaxSelect { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<Modifier> Modifiers { get; private set; } = [];

    public ModifierGroup(string name, int minSelect, int maxSelect)
    {
        Name = name;
        MinSelect = Math.Max(0, minSelect);
        MaxSelect = Math.Max(1, maxSelect);
    }

    public void Update(string name, int minSelect, int maxSelect)
    {
        Name = name;
        MinSelect = Math.Max(0, minSelect);
        MaxSelect = Math.Max(1, maxSelect);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A single priced option within a ModifierGroup (e.g. "Large" → +4.00).</summary>
public sealed class Modifier
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ModifierGroupId { get; private set; }
    public string Name { get; private set; } = null!;
    public decimal PriceDelta { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Modifier(Guid modifierGroupId, string name, decimal priceDelta, int sortOrder)
    {
        ModifierGroupId = modifierGroupId; Name = name; PriceDelta = priceDelta; SortOrder = sortOrder;
    }

    public void Update(string name, decimal priceDelta, int sortOrder, bool isActive)
    {
        Name = name; PriceDelta = priceDelta; SortOrder = sortOrder; IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>Which modifier groups apply to a given menu item, and in what order they're presented.</summary>
public sealed class MenuItemModifierGroup
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid MenuItemId { get; private set; }
    public Guid ModifierGroupId { get; private set; }
    public int SortOrder { get; private set; }

    public MenuItemModifierGroup(Guid menuItemId, Guid modifierGroupId, int sortOrder)
    {
        MenuItemId = menuItemId; ModifierGroupId = modifierGroupId; SortOrder = sortOrder;
    }
}
