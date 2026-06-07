namespace Softaxis.Inventory.Domain.Entities;

public sealed class Product
{
    private Product() { }

    public Product(
        string name, string? description, string? sku, string? barcode,
        Guid categoryId, Guid? brandId, Guid? unitOfMeasureId,
        decimal salePrice, decimal costPrice, decimal taxRate,
        string unit, decimal openingStock, decimal reorderLevel,
        bool trackInventory, string? imageUrl)
    {
        Id              = Guid.NewGuid();
        Name            = name.Trim();
        Description     = description?.Trim();
        SKU             = sku?.Trim().ToUpperInvariant();
        Barcode         = barcode?.Trim();
        CategoryId      = categoryId;
        BrandId         = brandId;
        UnitOfMeasureId = unitOfMeasureId;
        SalePrice       = Math.Round(salePrice, 2);
        CostPrice       = Math.Round(costPrice, 2);
        TaxRate         = Math.Round(taxRate, 2);
        Unit            = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        StockQuantity   = openingStock;
        ReorderLevel    = reorderLevel;
        TrackInventory  = trackInventory;
        ImageUrl        = imageUrl?.Trim();
        IsActive        = true;
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid     Id              { get; private set; }
    public string   Name            { get; private set; } = string.Empty;
    public string?  Description     { get; private set; }
    public string?  SKU             { get; private set; }
    public string?  Barcode         { get; private set; }
    public Guid     CategoryId      { get; private set; }
    public Guid?    BrandId         { get; private set; }
    public Guid?    UnitOfMeasureId { get; private set; }
    public decimal  SalePrice       { get; private set; }
    public decimal  CostPrice       { get; private set; }
    public decimal  TaxRate         { get; private set; }
    public string   Unit            { get; private set; } = "pcs";
    public decimal  StockQuantity   { get; private set; }
    public decimal  ReorderLevel    { get; private set; }
    public bool     TrackInventory  { get; private set; }
    public bool     IsActive        { get; private set; }
    public string?  ImageUrl        { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public bool      IsDeleted      { get; private set; }

    // Navigation
    public ProductCategory             Category       { get; private set; } = default!;
    public Brand?                      Brand          { get; private set; }
    public UnitOfMeasure?              UnitOfMeasure  { get; private set; }
    public ICollection<StockMovement>  Movements      { get; private set; } = new List<StockMovement>();
    public ICollection<ProductStock>   StockLevels    { get; private set; } = new List<ProductStock>();

    public bool IsLowStock => TrackInventory && StockQuantity <= ReorderLevel && ReorderLevel > 0;

    public void Update(
        string name, string? description, string? sku, string? barcode,
        Guid categoryId, Guid? brandId, Guid? unitOfMeasureId,
        decimal salePrice, decimal costPrice, decimal taxRate,
        string unit, decimal reorderLevel, bool trackInventory, string? imageUrl)
    {
        Name            = name.Trim();
        Description     = description?.Trim();
        SKU             = sku?.Trim().ToUpperInvariant();
        Barcode         = barcode?.Trim();
        CategoryId      = categoryId;
        BrandId         = brandId;
        UnitOfMeasureId = unitOfMeasureId;
        SalePrice       = Math.Round(salePrice, 2);
        CostPrice       = Math.Round(costPrice, 2);
        TaxRate         = Math.Round(taxRate, 2);
        Unit            = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        ReorderLevel    = reorderLevel;
        TrackInventory  = trackInventory;
        ImageUrl        = imageUrl?.Trim();
        UpdatedAt       = DateTime.UtcNow;
    }

    public void AdjustStock(decimal delta)
    {
        StockQuantity = Math.Max(0, StockQuantity + delta);
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Activate()   { IsActive = true;  UpdatedAt = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAt = DateTime.UtcNow; }
    public void Delete()     { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
