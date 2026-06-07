namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// On-hand quantity of a product in a specific warehouse. One row per
/// (Product, Warehouse) pair. The sum of all rows for a product equals the
/// product's global <see cref="Product.StockQuantity"/> (kept in sync for the
/// POS / sales path which reads the global total).
/// </summary>
public sealed class ProductStock
{
    private ProductStock() { }

    public ProductStock(Guid productId, Guid warehouseId, decimal quantity = 0, decimal reorderLevel = 0)
    {
        Id           = Guid.NewGuid();
        ProductId    = productId;
        WarehouseId  = warehouseId;
        Quantity     = quantity;
        ReorderLevel = reorderLevel;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public Guid      ProductId    { get; private set; }
    public Guid      WarehouseId  { get; private set; }
    public decimal   Quantity     { get; private set; }
    public decimal   ReorderLevel { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    // Navigation
    public Product?   Product   { get; private set; }
    public Warehouse? Warehouse { get; private set; }

    /// <summary>Apply a signed delta (negative = decrease). Never drops below zero.</summary>
    public void Adjust(decimal delta)
    {
        Quantity  = Math.Max(0, Quantity + delta);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetReorderLevel(decimal level)
    {
        ReorderLevel = level;
        UpdatedAt    = DateTime.UtcNow;
    }
}
