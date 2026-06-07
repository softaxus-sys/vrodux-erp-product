namespace Softaxis.Inventory.Domain.Entities;

/// <summary>
/// A batch / lot of a product in a warehouse, optionally with an expiry date.
/// Created when stock is received with a batch reference. Powers the
/// expiry-tracking report and per-product batch visibility.
/// </summary>
public sealed class ProductBatch
{
    private ProductBatch() { }

    public ProductBatch(Guid productId, Guid warehouseId, string batchNumber,
        DateTime? expiryDate, decimal quantity, decimal costPrice)
    {
        Id           = Guid.NewGuid();
        ProductId    = productId;
        WarehouseId  = warehouseId;
        BatchNumber  = batchNumber.Trim();
        ExpiryDate   = expiryDate;
        Quantity     = quantity;
        CostPrice    = costPrice;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      ProductId   { get; private set; }
    public Guid      WarehouseId { get; private set; }
    public string    BatchNumber { get; private set; } = string.Empty;
    public DateTime? ExpiryDate  { get; private set; }
    public decimal   Quantity    { get; private set; }
    public decimal   CostPrice   { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    // Navigation
    public Product?   Product   { get; private set; }
    public Warehouse? Warehouse { get; private set; }

    public void Adjust(decimal delta)
    {
        Quantity  = Math.Max(0, Quantity + delta);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetExpiry(DateTime? expiry)
    {
        ExpiryDate = expiry;
        UpdatedAt  = DateTime.UtcNow;
    }
}
