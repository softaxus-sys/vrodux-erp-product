namespace Softaxis.Restaurant.Domain.Entities;

public sealed class MenuCategory
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = null!; // starters/mains/desserts/drinks/specials
    public string? Description { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public List<MenuItem> Items { get; private set; } = [];

    public MenuCategory(string name, string? description, int sortOrder)
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
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public MenuItem(Guid categoryId, string name, string? description, decimal price,
        int prepTimeMinutes, string? allergens)
    {
        CategoryId = categoryId; Name = name; Description = description;
        Price = price; PrepTimeMinutes = prepTimeMinutes; Allergens = allergens;
    }

    public void SetAvailability(bool available) { IsAvailable = available; UpdatedAt = DateTime.UtcNow; }
    public void UpdatePrice(decimal price) { Price = price; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
