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

    // ── Online selling (all optional — a product sold only at the till never uses them) ──────────

    /// <summary>The online listing this product is a variant of. Null = not sold online.</summary>
    public Guid?    TemplateId         { get; private set; }
    /// <summary>JSON <c>{"Size":"M","Colour":"Red"}</c> — this variant's choices. Null when the template has none.</summary>
    public string?  VariantOptionsJson { get; private set; }
    /// <summary>Lets a single variant be hidden online (out of season) without unpublishing the whole listing.</summary>
    public bool     SellOnline         { get; private set; } = true;
    public decimal? WeightGrams        { get; private set; }
    public decimal? LengthCm           { get; private set; }
    public decimal? WidthCm            { get; private set; }
    public decimal? HeightCm           { get; private set; }

    // Navigation
    public ProductTemplate?            Template       { get; private set; }
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

    /// <summary>
    /// Moving-average cost: blends the cost of goods coming in with what is already on the shelf.
    /// Call BEFORE the quantity is adjusted. With nothing on hand the incoming cost simply becomes
    /// the cost.
    /// </summary>
    public void ApplyReceiptCost(decimal quantity, decimal unitCost)
    {
        if (quantity <= 0 || unitCost <= 0) return;
        var onHand = Math.Max(0, StockQuantity);
        CostPrice  = Math.Round((onHand * CostPrice + quantity * unitCost) / (onHand + quantity), 2);
        UpdatedAt  = DateTime.UtcNow;
    }

    public void AdjustStock(decimal delta)
    {
        StockQuantity = Math.Max(0, StockQuantity + delta);
        UpdatedAt     = DateTime.UtcNow;
    }

    /// <summary>Makes this product a variant of <paramref name="templateId"/> with the given choices.</summary>
    public void JoinTemplate(Guid templateId, IReadOnlyDictionary<string, string> choices)
    {
        TemplateId         = templateId;
        VariantOptionsJson = choices.Count == 0 ? null : System.Text.Json.JsonSerializer.Serialize(choices);
        UpdatedAt          = DateTime.UtcNow;
    }

    /// <summary>Takes this product out of its listing. The product itself — SKU, stock, history — is untouched.</summary>
    public void LeaveTemplate()
    {
        TemplateId = null; VariantOptionsJson = null;
        UpdatedAt  = DateTime.UtcNow;
    }

    public void SetOnlineDetails(bool sellOnline, decimal? weightGrams, decimal? lengthCm, decimal? widthCm, decimal? heightCm)
    {
        SellOnline  = sellOnline;
        WeightGrams = Positive(weightGrams);
        LengthCm    = Positive(lengthCm);
        WidthCm     = Positive(widthCm);
        HeightCm    = Positive(heightCm);
        UpdatedAt   = DateTime.UtcNow;
    }

    /// <summary>The variant's choices, or empty.</summary>
    public IReadOnlyDictionary<string, string> VariantOptions()
    {
        if (string.IsNullOrWhiteSpace(VariantOptionsJson)) return new Dictionary<string, string>();
        try { return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(VariantOptionsJson) ?? new(); }
        catch (System.Text.Json.JsonException) { return new Dictionary<string, string>(); }
    }

    private static decimal? Positive(decimal? v) => v is > 0 ? Math.Round(v.Value, 2) : null;

    public void Activate()   { IsActive = true;  UpdatedAt = DateTime.UtcNow; }
    public void Deactivate() { IsActive = false; UpdatedAt = DateTime.UtcNow; }
    public void Delete()     { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
