namespace Softaxis.Manufacturing.Domain.Entities;

/// <summary>
/// What goes into one batch of a finished product. <see cref="OutputQuantity"/> is the batch
/// size the line quantities are written for — a production order scales the lines by
/// (planned quantity / output quantity).
/// </summary>
public sealed class BillOfMaterials
{
    private BillOfMaterials() { }

    public BillOfMaterials(string name, Guid productId, string productName, string? productSku,
        decimal outputQuantity, string unit, string? notes)
    {
        Id        = Guid.NewGuid();
        BomNumber = $"BOM-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        SetHeader(name, productId, productName, productSku, outputQuantity, unit, notes);
    }

    public Guid      Id             { get; private set; }
    public string    BomNumber      { get; private set; } = null!;
    public string    Name           { get; private set; } = null!;

    // The finished product. An Inventory product id — no FK across schemas.
    public Guid      ProductId      { get; private set; }
    public string    ProductName    { get; private set; } = null!;
    public string?   ProductSku     { get; private set; }

    public decimal   OutputQuantity { get; private set; }
    public string    Unit           { get; private set; } = "pcs";
    public string    Status         { get; private set; } = BomStatus.Draft;
    public string?   Notes          { get; private set; }
    public bool      IsDeleted      { get; private set; }
    public DateTime  CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt      { get; private set; }

    public List<BomLine>      Lines      { get; private set; } = [];
    public List<BomOperation> Operations { get; private set; } = [];
    public List<BomByProduct> ByProducts { get; private set; } = [];

    /// <summary>Material cost of one batch, scrap included.</summary>
    public decimal MaterialCost => Lines.Sum(l => l.LineCost);

    /// <summary>Labour and overhead of one batch, from the routing.</summary>
    public decimal OperationCost => Operations.Sum(o => o.BatchCost);

    public decimal TotalCost => MaterialCost + OperationCost;

    public decimal CostPerUnit => OutputQuantity > 0 ? Math.Round(TotalCost / OutputQuantity, 4) : 0;

    public void Update(string name, Guid productId, string productName, string? productSku,
        decimal outputQuantity, string unit, string? notes)
    {
        SetHeader(name, productId, productName, productSku, outputQuantity, unit, notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceLines(IEnumerable<BomLine> lines)
    {
        Lines.Clear();
        Lines.AddRange(lines);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceOperations(IEnumerable<BomOperation> operations)
    {
        Operations.Clear();
        Operations.AddRange(operations);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceByProducts(IEnumerable<BomByProduct> byProducts)
    {
        ByProducts.Clear();
        ByProducts.AddRange(byProducts);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }
    public void Delete()                 { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void SetHeader(string name, Guid productId, string productName, string? productSku,
        decimal outputQuantity, string unit, string? notes)
    {
        Name           = name.Trim();
        ProductId      = productId;
        ProductName    = productName.Trim();
        ProductSku     = string.IsNullOrWhiteSpace(productSku) ? null : productSku.Trim();
        OutputQuantity = outputQuantity;
        Unit           = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        Notes          = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}

public sealed class BomLine
{
    private BomLine() { }

    public BomLine(Guid bomId, Guid componentProductId, string componentName, string? componentSku,
        decimal quantity, string unit, decimal scrapPercent, decimal unitCost, int sortOrder)
    {
        Id                 = Guid.NewGuid();
        BomId              = bomId;
        ComponentProductId = componentProductId;
        ComponentName      = componentName.Trim();
        ComponentSku       = string.IsNullOrWhiteSpace(componentSku) ? null : componentSku.Trim();
        Quantity           = quantity;
        Unit               = string.IsNullOrWhiteSpace(unit) ? "pcs" : unit.Trim();
        ScrapPercent       = scrapPercent;
        UnitCost           = unitCost;
        SortOrder          = sortOrder;
    }

    public Guid    Id                 { get; private set; }
    public Guid    BomId              { get; private set; }
    public Guid    ComponentProductId { get; private set; }
    public string  ComponentName      { get; private set; } = null!;
    public string? ComponentSku       { get; private set; }
    public decimal Quantity           { get; private set; }   // per batch, before scrap
    public string  Unit               { get; private set; } = "pcs";
    public decimal ScrapPercent       { get; private set; }
    public decimal UnitCost           { get; private set; }   // Inventory cost price when the line was saved
    public int     SortOrder          { get; private set; }

    /// <summary>Quantity to draw from stock for one batch, expected scrap included.</summary>
    public decimal EffectiveQuantity => Quantity * (1 + ScrapPercent / 100m);

    public decimal LineCost => Math.Round(EffectiveQuantity * UnitCost, 4);
}

public static class BomStatus
{
    public const string Draft    = "draft";
    public const string Active   = "active";
    public const string Archived = "archived";

    public static readonly IReadOnlyList<string> All = [Draft, Active, Archived];
}
