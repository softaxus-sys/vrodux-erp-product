namespace Softaxis.Finance.Domain.Entities;

public sealed class Invoice
{
    private Invoice() { }

    public Invoice(
        string  customerName,
        string? customerEmail,
        string  invoiceDate,
        string  dueDate,
        decimal taxRate,
        string? notes)
    {
        Id             = Guid.NewGuid();
        InvoiceNumber  = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        CustomerName   = customerName.Trim();
        CustomerEmail  = customerEmail?.Trim().ToLowerInvariant();
        InvoiceDate    = invoiceDate;
        DueDate        = dueDate;
        TaxRate        = taxRate;
        Status         = "draft";  // draft | sent | paid | overdue | cancelled
        Notes          = notes?.Trim();
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    InvoiceNumber { get; private set; } = string.Empty;
    public string    CustomerName  { get; private set; } = string.Empty;
    public string?   CustomerEmail { get; private set; }
    public string    InvoiceDate   { get; private set; } = string.Empty;
    public string    DueDate       { get; private set; } = string.Empty;
    public decimal   TaxRate       { get; private set; }
    public string    Status        { get; private set; } = "draft";
    public string?   Notes         { get; private set; }
    public DateTime? PaidAt        { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }

    public ICollection<InvoiceItem> Items { get; private set; } = new List<InvoiceItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxAmount => SubTotal * TaxRate / 100;
    public decimal Total     => SubTotal + TaxAmount;

    public void Update(string customerName, string? customerEmail, string invoiceDate, string dueDate, decimal taxRate, string? notes, string status)
    {
        CustomerName  = customerName.Trim();
        CustomerEmail = customerEmail?.Trim().ToLowerInvariant();
        InvoiceDate   = invoiceDate;
        DueDate       = dueDate;
        TaxRate       = taxRate;
        Notes         = notes?.Trim();
        Status        = status;
        if (status == "paid") PaidAt = DateTime.UtcNow;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void MarkPaid()
    {
        Status    = "paid";
        PaidAt    = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Send()
    {
        Status    = "sent";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class InvoiceItem
{
    private InvoiceItem() { }

    public InvoiceItem(Guid invoiceId, string description, decimal quantity, decimal unitPrice)
    {
        Id          = Guid.NewGuid();
        InvoiceId   = invoiceId;
        Description = description.Trim();
        Quantity    = quantity;
        UnitPrice   = unitPrice;
    }

    public Guid    Id          { get; private set; }
    public Guid    InvoiceId   { get; private set; }
    public string  Description { get; private set; } = string.Empty;
    public decimal Quantity    { get; private set; }
    public decimal UnitPrice   { get; private set; }
    public decimal LineTotal   => Quantity * UnitPrice;

    public Invoice? Invoice { get; private set; }
}
