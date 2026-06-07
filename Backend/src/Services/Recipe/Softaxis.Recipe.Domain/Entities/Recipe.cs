namespace Softaxis.Recipe.Domain.Entities;

public sealed class Recipe
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string RecipeNumber { get; private set; } = null!;

    // Link to Restaurant MenuItem (denormalised — no FK constraint across schemas)
    public Guid MenuItemId { get; private set; }
    public string MenuItemName { get; private set; } = null!;

    public string? Description { get; private set; }
    public int Servings { get; private set; } = 1;      // how many portions one batch yields
    public int PrepTimeMinutes { get; private set; }
    public int CookTimeMinutes { get; private set; }
    public string Status { get; private set; } = "draft"; // draft/active/archived
    public string? Instructions { get; private set; }
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;
    public List<RecipeIngredient> Ingredients { get; private set; } = [];

    // Computed — not mapped to DB; calculated at query time from Ingredients
    public decimal CostPerServing =>
        Servings > 0 && Ingredients.Count > 0
            ? Math.Round(Ingredients.Sum(i => i.Quantity * i.CostPerUnit) / Servings, 2)
            : 0;

    public Recipe(Guid menuItemId, string menuItemName, string? description,
        int servings, int prepTimeMinutes, int cookTimeMinutes, string? instructions, string? notes)
    {
        RecipeNumber = $"RCP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        MenuItemId = menuItemId; MenuItemName = menuItemName; Description = description;
        Servings = servings; PrepTimeMinutes = prepTimeMinutes; CookTimeMinutes = cookTimeMinutes;
        Instructions = instructions; Notes = notes;
    }

    public void Activate() { Status = "active"; UpdatedAt = DateTime.UtcNow; }
    public void Archive() { Status = "archived"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class RecipeIngredient
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid RecipeId { get; private set; }

    // Link to Inventory Product (nullable — ingredient may not exist in inventory yet)
    public Guid? InventoryProductId { get; private set; }
    public string ProductName { get; private set; } = null!;   // denormalised
    public decimal Quantity { get; private set; }              // quantity per batch
    public string Unit { get; private set; } = null!;          // kg/g/L/ml/pcs etc.
    public decimal CostPerUnit { get; private set; }           // synced from inventory.CostPrice
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    // Computed — not mapped
    public decimal LineTotal => Quantity * CostPerUnit;

    public RecipeIngredient(Guid recipeId, Guid? inventoryProductId, string productName,
        decimal quantity, string unit, decimal costPerUnit)
    {
        RecipeId = recipeId; InventoryProductId = inventoryProductId;
        ProductName = productName; Quantity = quantity; Unit = unit; CostPerUnit = costPerUnit;
    }

    public void UpdateCost(decimal costPerUnit) { CostPerUnit = costPerUnit; }
    public void Delete() { IsDeleted = true; }
}
