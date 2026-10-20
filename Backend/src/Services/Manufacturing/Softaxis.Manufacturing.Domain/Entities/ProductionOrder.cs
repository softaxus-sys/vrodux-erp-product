namespace Softaxis.Manufacturing.Domain.Entities;

/// <summary>
/// One production run of a finished product.
/// <code>planned → released → in_progress → completed</code>
/// with <c>cancelled</c> reachable until the first material is issued.
/// The component list is copied from the BOM when the order is created, so editing the BOM
/// later never changes an order already on the floor.
/// </summary>
public sealed class ProductionOrder
{
    private ProductionOrder() { }

    public ProductionOrder(Guid bomId, string bomNumber, Guid productId, string productName,
        string? productSku, decimal plannedQuantity, string unit, Guid? warehouseId,
        string? warehouseName, string? plannedStartDate, string? dueDate, string? reference, string? notes)
    {
        Id          = Guid.NewGuid();
        OrderNumber = $"MO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        BomId       = bomId;
        BomNumber   = bomNumber;
        ProductId   = productId;
        ProductName = productName;
        ProductSku  = productSku;
        Unit        = unit;
        SetPlan(plannedQuantity, warehouseId, warehouseName, plannedStartDate, dueDate, reference, notes);
    }

    public Guid      Id               { get; private set; }
    public string    OrderNumber      { get; private set; } = null!;
    public Guid      BomId            { get; private set; }
    public string    BomNumber        { get; private set; } = null!;

    public Guid      ProductId        { get; private set; }
    public string    ProductName      { get; private set; } = null!;
    public string?   ProductSku       { get; private set; }
    public string    Unit             { get; private set; } = "pcs";

    public decimal   PlannedQuantity  { get; private set; }
    public decimal   ProducedQuantity { get; private set; }

    // Where materials are drawn from and finished goods are received. Null = no warehouse bucket.
    public Guid?     WarehouseId      { get; private set; }
    public string?   WarehouseName    { get; private set; }

    public string    Status           { get; private set; } = ProductionOrderStatus.Planned;
    public string?   PlannedStartDate { get; private set; }   // yyyy-MM-dd
    public string?   DueDate          { get; private set; }   // yyyy-MM-dd
    public string?   Reference        { get; private set; }   // e.g. a sales order number
    public string?   Notes            { get; private set; }

    public DateTime? ReleasedAt       { get; private set; }
    public DateTime? StartedAt        { get; private set; }
    public DateTime? CompletedAt      { get; private set; }

    /// <summary>Cost of the materials actually issued so far.</summary>
    public decimal   MaterialCost     { get; private set; }

    /// <summary>Labour and overhead from the operation time recorded so far.</summary>
    public decimal   LabourCost       { get; private set; }
    public decimal   OverheadCost     { get; private set; }

    /// <summary>Total cost per good unit, fixed when the order is completed.</summary>
    public decimal   UnitCost         { get; private set; }

    /// <summary>Units made but rejected at inspection. They are not received into stock.</summary>
    public decimal   ScrappedQuantity { get; private set; }
    public string?   QualityNotes     { get; private set; }

    // The Finance journal entry this order's cost was posted with. Created by the client through
    // the Finance API — Manufacturing never writes to the ledger itself.
    public Guid?     JournalEntryId     { get; private set; }
    public string?   JournalEntryNumber { get; private set; }

    /// <summary>
    /// Cost of the rejected units when scrap is costed apart from the good output. Zero when the
    /// whole cost was carried by the good units.
    /// </summary>
    public decimal   ScrapCost          { get; private set; }

    /// <summary>The batch / lot the finished goods were received under, and when it expires.</summary>
    public string?   BatchNumber        { get; private set; }
    public string?   ExpiryDate         { get; private set; }   // yyyy-MM-dd

    /// <summary>The purchase request raised for this order's shortages (Purchase module's number).</summary>
    public string?   RequisitionNumber  { get; private set; }

    // Set on an order that exists to make a sub-assembly for another order.
    public Guid?     ParentOrderId      { get; private set; }
    public string?   ParentOrderNumber  { get; private set; }

    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt        { get; private set; }

    public List<ProductionOrderComponent> Components { get; private set; } = [];
    public List<ProductionOrderOperation> Operations { get; private set; } = [];
    public List<ProductionOrderOutput>    Outputs    { get; private set; } = [];
    public List<ProductionMaterialIssue>  Issues     { get; private set; } = [];

    public decimal TotalCost => MaterialCost + LabourCost + OverheadCost;

    public bool HasIssuedMaterials => Components.Any(c => c.IssuedQuantity > 0);

    public bool CanIssue =>
        Status is ProductionOrderStatus.Released or ProductionOrderStatus.InProgress;

    /// <summary>Only a planned order can be re-planned; afterwards the floor is working to it.</summary>
    public void UpdatePlan(decimal plannedQuantity, Guid? warehouseId, string? warehouseName,
        string? plannedStartDate, string? dueDate, string? reference, string? notes)
    {
        SetPlan(plannedQuantity, warehouseId, warehouseName, plannedStartDate, dueDate, reference, notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceComponents(IEnumerable<ProductionOrderComponent> components)
    {
        Components.Clear();
        Components.AddRange(components);
    }

    public void ReplaceOperations(IEnumerable<ProductionOrderOperation> operations)
    {
        Operations.Clear();
        Operations.AddRange(operations);
    }

    /// <summary>Records the time an operation actually took; re-recording replaces the earlier figure.</summary>
    public void RecordOperation(ProductionOrderOperation operation, decimal actualMinutes)
    {
        operation.Record(actualMinutes);
        LabourCost   = Operations.Sum(o => o.LabourCost);
        OverheadCost = Operations.Sum(o => o.OverheadCost);

        if (Status == ProductionOrderStatus.Released)
        {
            Status    = ProductionOrderStatus.InProgress;
            StartedAt = DateTime.UtcNow;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void LinkJournalEntry(Guid journalEntryId, string? journalEntryNumber)
    {
        JournalEntryId     = journalEntryId;
        JournalEntryNumber = string.IsNullOrWhiteSpace(journalEntryNumber) ? null : journalEntryNumber.Trim();
        UpdatedAt          = DateTime.UtcNow;
    }

    public bool Release()
    {
        if (Status != ProductionOrderStatus.Planned) return false;
        Status     = ProductionOrderStatus.Released;
        ReleasedAt = DateTime.UtcNow;
        UpdatedAt  = DateTime.UtcNow;
        return true;
    }

    public void ReplaceOutputs(IEnumerable<ProductionOrderOutput> outputs)
    {
        Outputs.Clear();
        Outputs.AddRange(outputs);
    }

    public void SetParent(Guid parentOrderId, string parentOrderNumber)
    {
        ParentOrderId     = parentOrderId;
        ParentOrderNumber = parentOrderNumber;
    }

    public void LinkRequisition(string requisitionNumber)
    {
        RequisitionNumber = requisitionNumber.Trim();
        UpdatedAt         = DateTime.UtcNow;
    }

    /// <summary>Records stock already taken out of Inventory for one component.</summary>
    public ProductionMaterialIssue RecordIssue(ProductionOrderComponent component, decimal quantity, string? batchNumber = null)
    {
        component.AddIssued(quantity);
        MaterialCost += Math.Round(quantity * component.UnitCost, 4);

        var entry = new ProductionMaterialIssue(Id, component.Id, component.ProductId, component.Name,
            quantity, component.UnitCost, batchNumber);
        Issues.Add(entry);

        if (Status == ProductionOrderStatus.Released)
        {
            Status    = ProductionOrderStatus.InProgress;
            StartedAt = DateTime.UtcNow;
        }
        UpdatedAt = DateTime.UtcNow;
        return entry;
    }

    /// <summary>Records stock already put back into Inventory for one component.</summary>
    public ProductionMaterialIssue RecordReturn(ProductionOrderComponent component, decimal quantity, string? batchNumber = null)
    {
        component.AddIssued(-quantity);
        MaterialCost = Math.Max(0, MaterialCost - Math.Round(quantity * component.UnitCost, 4));
        UpdatedAt    = DateTime.UtcNow;

        var entry = new ProductionMaterialIssue(Id, component.Id, component.ProductId, component.Name,
            -quantity, component.UnitCost, batchNumber);
        Issues.Add(entry);
        return entry;
    }

    /// <summary>
    /// Closes the order. Operations nobody timed are taken at their planned time, so labour and
    /// overhead are never silently missing from the cost.
    /// </summary>
    /// <param name="costScrapSeparately">
    /// False: the whole cost lands on the good units, so scrap makes each one dearer. True: the cost
    /// is spread over everything made, and the rejects' share is held in <see cref="ScrapCost"/>.
    /// </param>
    public void Complete(decimal producedQuantity, decimal scrappedQuantity = 0, string? qualityNotes = null,
        bool costScrapSeparately = false, string? batchNumber = null, string? expiryDate = null)
    {
        foreach (var op in Operations.Where(o => !o.IsDone)) op.Record(op.PlannedMinutes);
        LabourCost   = Operations.Sum(o => o.LabourCost);
        OverheadCost = Operations.Sum(o => o.OverheadCost);

        ProducedQuantity = producedQuantity;
        ScrappedQuantity = scrappedQuantity;
        QualityNotes     = Blank(qualityNotes);
        BatchNumber      = Blank(batchNumber);
        ExpiryDate       = Blank(expiryDate);

        var made = producedQuantity + scrappedQuantity;
        if (costScrapSeparately && scrappedQuantity > 0 && made > 0)
        {
            UnitCost  = Math.Round(TotalCost / made, 4);
            ScrapCost = Math.Round(TotalCost - UnitCost * producedQuantity, 4);
        }
        else
        {
            UnitCost  = producedQuantity > 0 ? Math.Round(TotalCost / producedQuantity, 4) : 0;
            ScrapCost = 0;
        }

        // By-products come out in proportion to what was actually made.
        var ratio = PlannedQuantity > 0 ? made / PlannedQuantity : 0;
        foreach (var output in Outputs) output.Receive(Math.Round(output.PlannedQuantity * ratio, 4));

        Status           = ProductionOrderStatus.Completed;
        CompletedAt      = DateTime.UtcNow;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = ProductionOrderStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private void SetPlan(decimal plannedQuantity, Guid? warehouseId, string? warehouseName,
        string? plannedStartDate, string? dueDate, string? reference, string? notes)
    {
        PlannedQuantity  = plannedQuantity;
        WarehouseId      = warehouseId;
        WarehouseName    = warehouseId is null ? null : warehouseName;
        PlannedStartDate = Blank(plannedStartDate);
        DueDate          = Blank(dueDate);
        Reference        = Blank(reference);
        Notes            = Blank(notes);
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public sealed class ProductionOrderComponent
{
    private ProductionOrderComponent() { }

    public ProductionOrderComponent(Guid productionOrderId, Guid productId, string name, string? sku,
        decimal requiredQuantity, string unit, decimal unitCost, int sortOrder)
    {
        Id                = Guid.NewGuid();
        ProductionOrderId = productionOrderId;
        ProductId         = productId;
        Name              = name;
        Sku               = sku;
        RequiredQuantity  = requiredQuantity;
        Unit              = unit;
        UnitCost          = unitCost;
        SortOrder         = sortOrder;
    }

    public Guid    Id                { get; private set; }
    public Guid    ProductionOrderId { get; private set; }
    public Guid    ProductId         { get; private set; }
    public string  Name              { get; private set; } = null!;
    public string? Sku               { get; private set; }
    public decimal RequiredQuantity  { get; private set; }
    public decimal IssuedQuantity    { get; private set; }
    public string  Unit              { get; private set; } = "pcs";
    public decimal UnitCost          { get; private set; }
    public int     SortOrder         { get; private set; }

    public decimal RemainingQuantity => Math.Max(0, RequiredQuantity - IssuedQuantity);

    internal void AddIssued(decimal quantity) => IssuedQuantity += quantity;
}

public static class ProductionOrderStatus
{
    public const string Planned    = "planned";
    public const string Released   = "released";
    public const string InProgress = "in_progress";
    public const string Completed  = "completed";
    public const string Cancelled  = "cancelled";
}
