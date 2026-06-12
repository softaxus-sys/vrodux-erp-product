namespace Softaxis.Finance.Domain.Entities;

public sealed class PurchaseBill
{
    private PurchaseBill() { }

    public PurchaseBill(
        Guid    supplierId,
        string  supplierName,
        string  billDate,
        string  dueDate,
        decimal taxRate,
        string? reference,
        string? notes)
    {
        Id           = Guid.NewGuid();
        BillNumber   = $"BILL-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        SupplierId   = supplierId;
        SupplierName = supplierName.Trim();
        BillDate     = billDate;
        DueDate      = dueDate;
        TaxRate      = taxRate;
        Reference    = reference?.Trim();
        Notes        = notes?.Trim();
        Status       = "draft";  // draft | approved | partially_paid | paid | cancelled
        CreatedAt    = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public string    BillNumber   { get; private set; } = string.Empty;
    public Guid      SupplierId   { get; private set; }
    public string    SupplierName { get; private set; } = string.Empty;
    public string    BillDate     { get; private set; } = string.Empty;
    public string    DueDate      { get; private set; } = string.Empty;
    public decimal   TaxRate      { get; private set; }
    public string    CurrencyCode { get; private set; } = "AED";
    public string    Status       { get; private set; } = "draft";
    public string?   Reference    { get; private set; }
    public string?   Notes        { get; private set; }
    public decimal   AmountPaid   { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }
    public Guid?     JournalEntryId { get; private set; }

    public ICollection<PurchaseBillItem> Items { get; private set; } = new List<PurchaseBillItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxAmount => SubTotal * TaxRate / 100;
    public decimal Total     => SubTotal + TaxAmount;
    public decimal AmountDue => Total - AmountPaid;

    public void Update(string supplierName, string billDate, string dueDate, decimal taxRate, string? reference, string? notes)
    {
        SupplierName = supplierName.Trim();
        BillDate     = billDate;
        DueDate      = dueDate;
        TaxRate      = taxRate;
        Reference    = reference?.Trim();
        Notes        = notes?.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Approve()
    {
        Status    = "approved";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordPayment(decimal amount)
    {
        AmountPaid += amount;
        Status      = AmountPaid >= Total ? "paid" : "partially_paid";
        UpdatedAt   = DateTime.UtcNow;
    }

    public void ReversePayment(decimal amount)
    {
        AmountPaid = Math.Max(0, AmountPaid - amount);
        Status     = AmountPaid <= 0 ? "approved" : "partially_paid";
        UpdatedAt  = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void SetJournalEntryId(Guid? journalEntryId) { JournalEntryId = journalEntryId; UpdatedAt = DateTime.UtcNow; }
}

public sealed class PurchaseBillItem
{
    private PurchaseBillItem() { }

    public PurchaseBillItem(Guid billId, string description, decimal quantity, decimal unitPrice)
    {
        Id          = Guid.NewGuid();
        BillId      = billId;
        Description = description.Trim();
        Quantity    = quantity;
        UnitPrice   = unitPrice;
    }

    public Guid    Id          { get; private set; }
    public Guid    BillId      { get; private set; }
    public string  Description { get; private set; } = string.Empty;
    public decimal Quantity    { get; private set; }
    public decimal UnitPrice   { get; private set; }
    public decimal LineTotal   => Quantity * UnitPrice;

    public PurchaseBill? Bill { get; private set; }
}
