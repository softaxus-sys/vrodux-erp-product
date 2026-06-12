namespace Softaxis.Sales.Domain.Entities;

public sealed class DeliveryChallan
{
    private DeliveryChallan() { }

    public DeliveryChallan(Guid salesOrderId, Guid? customerId, string challanDate, string? driverName, string? notes)
    {
        Id           = Guid.NewGuid();
        ChallanNumber = $"DC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        SalesOrderId = salesOrderId;
        CustomerId   = customerId;
        ChallanDate  = challanDate;
        DriverName   = driverName?.Trim();
        Notes        = notes?.Trim();
        Status       = "posted";
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public string   ChallanNumber { get; private set; } = string.Empty;
    public Guid     SalesOrderId  { get; private set; }
    public Guid?    CustomerId    { get; private set; }
    public string   ChallanDate   { get; private set; } = string.Empty;
    public string?  DriverName    { get; private set; }
    public string?  Notes         { get; private set; }
    public string   Status        { get; private set; } = "posted"; // posted | cancelled
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public SalesOrder? SalesOrder { get; private set; }
    public Customer?   Customer   { get; private set; }
    public ICollection<DeliveryChallanItem> Items { get; private set; } = new List<DeliveryChallanItem>();

    public void AddItem(Guid? salesOrderItemId, Guid? productId, string description,
        decimal orderedQuantity, decimal deliveredQuantity, decimal unitPrice)
    {
        Items.Add(new DeliveryChallanItem(Id, salesOrderItemId, productId, description, orderedQuantity, deliveredQuantity, unitPrice));
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }
}

public sealed class DeliveryChallanItem
{
    private DeliveryChallanItem() { }

    public DeliveryChallanItem(Guid deliveryChallanId, Guid? salesOrderItemId, Guid? productId, string description,
        decimal orderedQuantity, decimal deliveredQuantity, decimal unitPrice)
    {
        Id                 = Guid.NewGuid();
        DeliveryChallanId  = deliveryChallanId;
        SalesOrderItemId   = salesOrderItemId;
        ProductId          = productId;
        Description        = description.Trim();
        OrderedQuantity    = orderedQuantity;
        DeliveredQuantity  = deliveredQuantity;
        UnitPrice          = unitPrice;
    }

    public Guid    Id                { get; private set; }
    public Guid    DeliveryChallanId { get; private set; }
    public Guid?   SalesOrderItemId  { get; private set; }
    public Guid?   ProductId         { get; private set; }
    public string  Description       { get; private set; } = string.Empty;
    public decimal OrderedQuantity   { get; private set; }
    public decimal DeliveredQuantity { get; private set; }
    public decimal UnitPrice         { get; private set; }
    public decimal LineTotal         => DeliveredQuantity * UnitPrice;

    public DeliveryChallan? DeliveryChallan { get; private set; }
}
