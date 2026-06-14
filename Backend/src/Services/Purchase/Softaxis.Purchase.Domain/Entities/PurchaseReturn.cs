namespace Softaxis.Purchase.Domain.Entities;

public sealed class PurchaseReturn
{
    private readonly List<PurchaseReturnItem> _items = [];

    private PurchaseReturn() { }

    public PurchaseReturn(Guid purchaseOrderId, Guid vendorId, string returnDate,
        string reason, string? notes)
    {
        Id              = Guid.NewGuid();
        ReturnNumber    = $"PRET-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        PurchaseOrderId = purchaseOrderId;
        VendorId        = vendorId;
        ReturnDate      = returnDate;
        Reason          = reason.Trim();
        Notes           = notes?.Trim();
        Status          = "posted";
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid    Id              { get; private set; }
    public string  ReturnNumber    { get; private set; } = string.Empty;
    public Guid    PurchaseOrderId { get; private set; }
    public Guid    VendorId        { get; private set; }
    public string  ReturnDate      { get; private set; } = string.Empty;
    public string  Reason          { get; private set; } = string.Empty;
    public string? Notes           { get; private set; }
    public string  Status          { get; private set; } = "posted"; // posted | cancelled
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }

    public PurchaseOrder? PurchaseOrder { get; private set; }
    public Vendor?        Vendor        { get; private set; }
    public IReadOnlyCollection<PurchaseReturnItem> Items => _items;

    public decimal TotalAmount => _items.Sum(i => i.LineTotal);

    public void AddItem(Guid? purchaseOrderItemId, Guid? productId, string description,
        decimal quantity, decimal unitCost) =>
        _items.Add(new PurchaseReturnItem(Id, purchaseOrderItemId, productId, description, quantity, unitCost));

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class PurchaseReturnItem
{
    private PurchaseReturnItem() { }

    public PurchaseReturnItem(Guid purchaseReturnId, Guid? purchaseOrderItemId, Guid? productId,
        string description, decimal quantity, decimal unitCost)
    {
        Id                  = Guid.NewGuid();
        PurchaseReturnId    = purchaseReturnId;
        PurchaseOrderItemId = purchaseOrderItemId;
        ProductId           = productId;
        Description         = description.Trim();
        Quantity            = quantity;
        UnitCost            = unitCost;
    }

    public Guid    Id                  { get; private set; }
    public Guid    PurchaseReturnId    { get; private set; }
    public Guid?   PurchaseOrderItemId { get; private set; }
    public Guid?   ProductId           { get; private set; }
    public string  Description         { get; private set; } = string.Empty;
    public decimal Quantity            { get; private set; }
    public decimal UnitCost            { get; private set; }
    public decimal LineTotal           => Quantity * UnitCost;

    public PurchaseReturn? PurchaseReturn { get; private set; }
}
