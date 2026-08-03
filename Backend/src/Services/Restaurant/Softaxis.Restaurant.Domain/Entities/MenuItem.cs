namespace Softaxis.Restaurant.Domain.Entities;

public sealed class MenuCategory
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = null!; // starters/mains/desserts/drinks/specials
    public string? Description { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; } = true;
    /// <summary>Default kitchen station for items in this category — an item's own
    /// KitchenStationId (if set) always wins over this fallback.</summary>
    public Guid? KitchenStationId { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public List<MenuItem> Items { get; private set; } = [];

    public MenuCategory(string name, string? description, int sortOrder, Guid? kitchenStationId = null)
    {
        Name = name; Description = description; SortOrder = sortOrder; KitchenStationId = kitchenStationId;
    }

    public void SetKitchenStation(Guid? kitchenStationId) => KitchenStationId = kitchenStationId;

    public void Update(string name, string? description, int sortOrder)
    {
        Name = name; Description = description; SortOrder = sortOrder;
    }

    public void Delete() { IsDeleted = true; }
}

public sealed class MenuItem
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid CategoryId { get; private set; }
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public decimal Price { get; private set; }
    public int PrepTimeMinutes { get; private set; }
    public string? Allergens { get; private set; }
    public bool IsAvailable { get; private set; } = true;
    /// <summary>Overrides the category's default station for this specific item (null = use the category's).</summary>
    public Guid? KitchenStationId { get; private set; }
    /// <summary>Whether this item can be ordered through QR-table / kiosk / online-ordering channels
    /// (see the anonymous public-orders endpoint) — separate from IsAvailable, which is the 86-list
    /// flag staff toggle for stock-outs. Defaults true so existing items show up online without a migration step.</summary>
    public bool IsOnlineOrderable { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public MenuItem(Guid categoryId, string name, string? description, decimal price,
        int prepTimeMinutes, string? allergens, Guid? kitchenStationId = null)
    {
        CategoryId = categoryId; Name = name; Description = description;
        Price = price; PrepTimeMinutes = prepTimeMinutes; Allergens = allergens; KitchenStationId = kitchenStationId;
    }

    public void SetAvailability(bool available) { IsAvailable = available; UpdatedAt = DateTime.UtcNow; }
    public void UpdatePrice(decimal price) { Price = price; UpdatedAt = DateTime.UtcNow; }
    public void Update(string name, string? description, decimal price, int prepTimeMinutes, string? allergens)
    {
        Name = name; Description = description; Price = price;
        PrepTimeMinutes = prepTimeMinutes; Allergens = allergens; UpdatedAt = DateTime.UtcNow;
    }
    public void SetKitchenStation(Guid? kitchenStationId) { KitchenStationId = kitchenStationId; UpdatedAt = DateTime.UtcNow; }
    public void SetOnlineOrderable(bool isOnlineOrderable) { IsOnlineOrderable = isOnlineOrderable; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
