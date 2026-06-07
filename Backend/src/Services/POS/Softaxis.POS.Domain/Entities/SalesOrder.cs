namespace Softaxis.POS.Domain.Entities;

public sealed class SalesOrder
{
    private SalesOrder() { }

    public SalesOrder(Guid? customerId, string? customerName, string? notes, string? expectedDate)
    {
        Id           = Guid.NewGuid();
        OrderNumber  = $"SO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        CustomerId   = customerId;
        CustomerName = customerName?.Trim();
        Status       = "pending";
        Notes        = notes?.Trim();
        ExpectedDate = expectedDate;
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid    Id           { get; private set; }
    public string  OrderNumber  { get; private set; } = string.Empty;
    public Guid?   CustomerId   { get; private set; }
    public string? CustomerName { get; private set; }
    public string  Status       { get; private set; } = "pending"; // pending | confirmed | shipped | delivered | cancelled
    public string? Notes        { get; private set; }
    public string? ExpectedDate { get; private set; }
    public string? DeliveredDate { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }
    public bool      IsDeleted  { get; private set; }

    public Customer? Customer { get; private set; }
    public ICollection<SalesOrderItem> Items { get; private set; } = new List<SalesOrderItem>();

    public decimal SubTotal   => Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100));
    public decimal TaxAmount  => Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100);
    public decimal Total      => SubTotal + TaxAmount;

    public void Update(Guid? customerId, string? customerName, string? notes, string? expectedDate, string status)
    {
        CustomerId   = customerId;
        CustomerName = customerName?.Trim();
        Notes        = notes?.Trim();
        ExpectedDate = expectedDate;
        Status       = status;
        UpdatedAt    = DateTime.UtcNow;
        if (status == "delivered") DeliveredDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class SalesOrderItem
{
    private SalesOrderItem() { }

    public SalesOrderItem(Guid salesOrderId, Guid? productId, string description,
        decimal quantity, decimal unitPrice, decimal discountPercent, decimal taxRate)
    {
        Id           = Guid.NewGuid();
        SalesOrderId = salesOrderId;
        ProductId    = productId;
        Description  = description.Trim();
        Quantity     = quantity;
        UnitPrice    = unitPrice;
        DiscountPercent = discountPercent;
        TaxRate      = taxRate;
    }

    public Guid    Id              { get; private set; }
    public Guid    SalesOrderId    { get; private set; }
    public Guid?   ProductId       { get; private set; }
    public string  Description     { get; private set; } = string.Empty;
    public decimal Quantity        { get; private set; }
    public decimal UnitPrice       { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal TaxRate         { get; private set; }
    public decimal LineTotal       => Quantity * UnitPrice * (1 - DiscountPercent / 100);

    public SalesOrder? SalesOrder { get; private set; }
    public Product?    Product    { get; private set; }
}
