namespace Softaxis.Manufacturing.Domain.Entities;

/// <summary>
/// One movement of a component between stock and a production order. Issues are positive,
/// returns negative. This is the trail that says which material batch went into which order —
/// and so, through the order's own batch number, into which finished goods.
/// </summary>
public sealed class ProductionMaterialIssue
{
    private ProductionMaterialIssue() { }

    public ProductionMaterialIssue(Guid productionOrderId, Guid componentId, Guid productId, string productName,
        decimal quantity, decimal unitCost, string? batchNumber)
    {
        Id                = Guid.NewGuid();
        ProductionOrderId = productionOrderId;
        ComponentId       = componentId;
        ProductId         = productId;
        ProductName       = productName;
        Quantity          = quantity;
        UnitCost          = unitCost;
        BatchNumber       = string.IsNullOrWhiteSpace(batchNumber) ? null : batchNumber.Trim();
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid     Id                { get; private set; }
    public Guid     ProductionOrderId { get; private set; }
    public Guid     ComponentId       { get; private set; }
    public Guid     ProductId         { get; private set; }
    public string   ProductName       { get; private set; } = null!;
    public decimal  Quantity          { get; private set; }   // negative = returned to stock
    public decimal  UnitCost          { get; private set; }
    public string?  BatchNumber       { get; private set; }
    public DateTime CreatedAt         { get; private set; }
}

/// <summary>
/// Something a BOM yields besides its main product — offcuts, whey, a second grade. Quantity is
/// per batch, like the component lines.
/// </summary>
public sealed class BomByProduct
{
    private BomByProduct() { }

    public BomByProduct(Guid bomId, Guid productId, string productName, string? productSku, decimal quantity, string unit)
    {
        Id          = Guid.NewGuid();
        BomId       = bomId;
        ProductId   = productId;
        ProductName = productName;
        ProductSku  = productSku;
        Quantity    = quantity;
        Unit        = unit;
    }

    public Guid    Id          { get; private set; }
    public Guid    BomId       { get; private set; }
    public Guid    ProductId   { get; private set; }
    public string  ProductName { get; private set; } = null!;
    public string? ProductSku  { get; private set; }
    public decimal Quantity    { get; private set; }
    public string  Unit        { get; private set; } = "pcs";
}

/// <summary>A by-product expected from, and then received by, one production order.</summary>
public sealed class ProductionOrderOutput
{
    private ProductionOrderOutput() { }

    public ProductionOrderOutput(Guid productionOrderId, Guid productId, string name, string? sku, string unit, decimal plannedQuantity)
    {
        Id                = Guid.NewGuid();
        ProductionOrderId = productionOrderId;
        ProductId         = productId;
        Name              = name;
        Sku               = sku;
        Unit              = unit;
        PlannedQuantity   = plannedQuantity;
    }

    public Guid    Id                { get; private set; }
    public Guid    ProductionOrderId { get; private set; }
    public Guid    ProductId         { get; private set; }
    public string  Name              { get; private set; } = null!;
    public string? Sku               { get; private set; }
    public string  Unit              { get; private set; } = "pcs";
    public decimal PlannedQuantity   { get; private set; }
    public decimal ReceivedQuantity  { get; private set; }

    internal void Receive(decimal quantity) => ReceivedQuantity = quantity;
}

/// <summary>
/// One row per workspace: the last day the daily production digest went out, so a restart does
/// not send it twice.
/// </summary>
public sealed class ManufacturingAlertState
{
    private ManufacturingAlertState() { }

    public ManufacturingAlertState(string lastDigestDate)
    {
        Id             = Guid.NewGuid();
        LastDigestDate = lastDigestDate;
    }

    public Guid   Id             { get; private set; }
    public string LastDigestDate { get; private set; } = null!;   // yyyy-MM-dd

    public void Mark(string date) => LastDigestDate = date;
}
