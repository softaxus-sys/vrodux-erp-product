namespace Softaxis.Inventory.Domain.Entities;

public sealed class StockMovement
{
    private StockMovement() { }

    public StockMovement(
        Guid productId, string movementType, decimal quantity,
        decimal unitCost, string? reference, string? notes, string? warehouseId)
    {
        Id           = Guid.NewGuid();
        ProductId    = productId;
        MovementType = movementType; // Receipt | Sale | Adjustment | Transfer | WriteOff | Return
        Quantity     = quantity;
        UnitCost     = unitCost;
        Reference    = reference?.Trim();
        Notes        = notes?.Trim();
        WarehouseId  = string.IsNullOrWhiteSpace(warehouseId) ? null : Guid.Parse(warehouseId);
        MovedAt      = DateTime.UtcNow;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public Guid     ProductId    { get; private set; }
    public string   MovementType { get; private set; } = string.Empty;
    public decimal  Quantity     { get; private set; }  // positive = in, negative = out
    public decimal  UnitCost     { get; private set; }
    public string?  Reference    { get; private set; }  // PO number, SO number, etc.
    public string?  Notes        { get; private set; }
    public Guid?    WarehouseId  { get; private set; }
    public DateTime MovedAt      { get; private set; }
    public DateTime CreatedAt    { get; private set; }
    public bool     IsDeleted    { get; private set; }

    // Navigation
    public Product?   Product   { get; private set; }
    public Warehouse? Warehouse { get; private set; }

    public void Delete() { IsDeleted = true; }
}
