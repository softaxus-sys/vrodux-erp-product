namespace Softaxis.POS.Domain.Entities;

public sealed class SalesQuotation
{
    private SalesQuotation() { }

    public SalesQuotation(Guid? customerId, string? customerName, string? notes, string? validUntil)
    {
        Id             = Guid.NewGuid();
        QuotationNumber = $"QT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        CustomerId     = customerId;
        CustomerName   = customerName?.Trim();
        Status         = "draft";
        Notes          = notes?.Trim();
        ValidUntil     = validUntil;
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid    Id              { get; private set; }
    public string  QuotationNumber { get; private set; } = string.Empty;
    public Guid?   CustomerId      { get; private set; }
    public string? CustomerName    { get; private set; }
    public string  Status          { get; private set; } = "draft"; // draft | sent | approved | rejected | expired | converted
    public string? Notes           { get; private set; }
    public string? ValidUntil      { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }

    public Customer? Customer { get; private set; }
    public ICollection<SalesQuotationItem> Items { get; private set; } = new List<SalesQuotationItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100));
    public decimal TaxAmount => Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100);
    public decimal Total     => SubTotal + TaxAmount;

    public void Update(Guid? customerId, string? customerName, string? notes, string? validUntil, string status)
    {
        CustomerId   = customerId;
        CustomerName = customerName?.Trim();
        Notes        = notes?.Trim();
        ValidUntil   = validUntil;
        Status       = status;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class SalesQuotationItem
{
    private SalesQuotationItem() { }

    public SalesQuotationItem(Guid quotationId, Guid? productId, string description,
        decimal quantity, decimal unitPrice, decimal discountPercent, decimal taxRate)
    {
        Id           = Guid.NewGuid();
        QuotationId  = quotationId;
        ProductId    = productId;
        Description  = description.Trim();
        Quantity     = quantity;
        UnitPrice    = unitPrice;
        DiscountPercent = discountPercent;
        TaxRate      = taxRate;
    }

    public Guid    Id              { get; private set; }
    public Guid    QuotationId     { get; private set; }
    public Guid?   ProductId       { get; private set; }
    public string  Description     { get; private set; } = string.Empty;
    public decimal Quantity        { get; private set; }
    public decimal UnitPrice       { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal TaxRate         { get; private set; }
    public decimal LineTotal       => Quantity * UnitPrice * (1 - DiscountPercent / 100);

    public SalesQuotation? Quotation { get; private set; }
    public Product?        Product   { get; private set; }
}
