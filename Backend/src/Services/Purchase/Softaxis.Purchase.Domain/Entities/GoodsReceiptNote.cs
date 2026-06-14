namespace Softaxis.Purchase.Domain.Entities;

public sealed class GoodsReceiptNote
{
    private readonly List<GoodsReceiptNoteItem> _items = [];

    private GoodsReceiptNote() { }

    public GoodsReceiptNote(Guid purchaseOrderId, Guid vendorId, string grnDate,
        string? driverName, string? notes)
    {
        Id              = Guid.NewGuid();
        GrnNumber       = $"GRN-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        PurchaseOrderId = purchaseOrderId;
        VendorId        = vendorId;
        GrnDate         = grnDate;
        DriverName      = driverName?.Trim();
        Notes           = notes?.Trim();
        Status          = "posted";
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid    Id              { get; private set; }
    public string  GrnNumber       { get; private set; } = string.Empty;
    public Guid    PurchaseOrderId { get; private set; }
    public Guid    VendorId        { get; private set; }
    public string  GrnDate         { get; private set; } = string.Empty;
    public string? DriverName      { get; private set; }
    public string? Notes           { get; private set; }
    public string  Status          { get; private set; } = "posted"; // posted | cancelled
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }

    public PurchaseOrder? PurchaseOrder { get; private set; }
    public Vendor?        Vendor        { get; private set; }
    public IReadOnlyCollection<GoodsReceiptNoteItem> Items => _items;

    public void AddItem(Guid? purchaseOrderItemId, Guid? productId, string description,
        decimal orderedQuantity, decimal receivedQuantity, decimal unitCost) =>
        _items.Add(new GoodsReceiptNoteItem(Id, purchaseOrderItemId, productId, description,
            orderedQuantity, receivedQuantity, unitCost));

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class GoodsReceiptNoteItem
{
    private GoodsReceiptNoteItem() { }

    public GoodsReceiptNoteItem(Guid goodsReceiptNoteId, Guid? purchaseOrderItemId, Guid? productId,
        string description, decimal orderedQuantity, decimal receivedQuantity, decimal unitCost)
    {
        Id                  = Guid.NewGuid();
        GoodsReceiptNoteId  = goodsReceiptNoteId;
        PurchaseOrderItemId = purchaseOrderItemId;
        ProductId           = productId;
        Description         = description.Trim();
        OrderedQuantity     = orderedQuantity;
        ReceivedQuantity    = receivedQuantity;
        UnitCost            = unitCost;
    }

    public Guid    Id                  { get; private set; }
    public Guid    GoodsReceiptNoteId  { get; private set; }
    public Guid?   PurchaseOrderItemId { get; private set; }
    public Guid?   ProductId           { get; private set; }
    public string  Description         { get; private set; } = string.Empty;
    public decimal OrderedQuantity     { get; private set; }
    public decimal ReceivedQuantity    { get; private set; }
    public decimal UnitCost            { get; private set; }
    public decimal LineTotal           => ReceivedQuantity * UnitCost;

    public GoodsReceiptNote? GoodsReceiptNote { get; private set; }
}
