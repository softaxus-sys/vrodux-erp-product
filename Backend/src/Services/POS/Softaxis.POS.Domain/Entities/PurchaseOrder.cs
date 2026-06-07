namespace Softaxis.POS.Domain.Entities;

public sealed class PurchaseOrder
{
    private PurchaseOrder() { }

    public PurchaseOrder(Guid vendorId, string? notes, string? expectedDate)
    {
        Id           = Guid.NewGuid();
        OrderNumber  = $"PO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        VendorId     = vendorId;
        Status       = "draft";
        Notes        = notes?.Trim();
        ExpectedDate = expectedDate;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public string   OrderNumber { get; private set; } = string.Empty;
    public Guid     VendorId    { get; private set; }
    public string   Status      { get; private set; } = "draft"; // draft | sent | received | partial | cancelled
    public string?  Notes       { get; private set; }
    public string?  ExpectedDate { get; private set; }
    public string?  ReceivedDate { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }
    public bool      IsDeleted  { get; private set; }

    public Vendor? Vendor { get; private set; }
    public ICollection<PurchaseOrderItem> Items { get; private set; } = new List<PurchaseOrderItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitCost);
    public decimal TaxAmount => Items.Sum(i => i.Quantity * i.UnitCost * i.TaxRate / 100);
    public decimal Total     => SubTotal + TaxAmount;

    public void UpdateStatus(string status)
    {
        Status    = status;
        UpdatedAt = DateTime.UtcNow;
        if (status == "received") ReceivedDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
    }

    public void Update(Guid vendorId, string? notes, string? expectedDate, string status)
    {
        VendorId     = vendorId;
        Notes        = notes?.Trim();
        ExpectedDate = expectedDate;
        Status       = status;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PurchaseOrderItem
{
    private PurchaseOrderItem() { }

    public PurchaseOrderItem(Guid purchaseOrderId, Guid? productId, string description,
        decimal quantity, decimal unitCost, decimal taxRate)
    {
        Id              = Guid.NewGuid();
        PurchaseOrderId = purchaseOrderId;
        ProductId       = productId;
        Description     = description.Trim();
        Quantity        = quantity;
        UnitCost        = unitCost;
        TaxRate         = taxRate;
    }

    public Guid    Id              { get; private set; }
    public Guid    PurchaseOrderId { get; private set; }
    public Guid?   ProductId       { get; private set; }
    public string  Description     { get; private set; } = string.Empty;
    public decimal Quantity        { get; private set; }
    public decimal UnitCost        { get; private set; }
    public decimal TaxRate         { get; private set; }
    public decimal LineTotal       => Quantity * UnitCost;

    public PurchaseOrder? PurchaseOrder { get; private set; }
    public Product?       Product       { get; private set; }
}
