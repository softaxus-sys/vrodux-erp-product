namespace Softaxis.Finance.Domain.Entities;

public sealed class ReceiptVoucher
{
    private ReceiptVoucher() { }

    public ReceiptVoucher(
        Guid    customerId,
        string  customerName,
        string  receiptDate,
        decimal amount,
        string? receiptMethod,
        Guid?   bankAccountId,
        string? reference,
        string? notes)
    {
        Id            = Guid.NewGuid();
        VoucherNumber = $"RV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        CustomerId    = customerId;
        CustomerName  = customerName.Trim();
        ReceiptDate   = receiptDate;
        Amount        = amount;
        ReceiptMethod = receiptMethod?.Trim();
        BankAccountId = bankAccountId;
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        Status        = "draft";  // draft | posted | void
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    VoucherNumber { get; private set; } = string.Empty;
    public Guid      CustomerId    { get; private set; }
    public string    CustomerName  { get; private set; } = string.Empty;
    public string    ReceiptDate   { get; private set; } = string.Empty;
    public decimal   Amount        { get; private set; }
    public string?   ReceiptMethod { get; private set; }
    public Guid?     BankAccountId { get; private set; }
    public string?   Reference     { get; private set; }
    public string?   Notes         { get; private set; }
    public string    CurrencyCode  { get; private set; } = "AED";
    public string    Status        { get; private set; } = "draft";
    public DateTime? PostedAt      { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }
    public Guid?     JournalEntryId { get; private set; }

    public ICollection<ReceiptAllocation> Allocations { get; private set; } = new List<ReceiptAllocation>();

    public decimal AllocatedTotal => Allocations.Sum(a => a.AmountApplied);

    public void Update(string customerName, string receiptDate, decimal amount, string? receiptMethod,
        Guid? bankAccountId, string? reference, string? notes)
    {
        CustomerName  = customerName.Trim();
        ReceiptDate   = receiptDate;
        Amount        = amount;
        ReceiptMethod = receiptMethod?.Trim();
        BankAccountId = bankAccountId;
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        UpdatedAt     = DateTime.UtcNow;
    }

    public void ReplaceAllocations(IEnumerable<ReceiptAllocation> allocations)
    {
        Allocations.Clear();
        foreach (var allocation in allocations)
            Allocations.Add(allocation);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Post()
    {
        Status    = "posted";
        PostedAt  = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Void()
    {
        Status    = "void";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void SetJournalEntryId(Guid? journalEntryId) { JournalEntryId = journalEntryId; UpdatedAt = DateTime.UtcNow; }
}

public sealed class ReceiptAllocation
{
    private ReceiptAllocation() { }

    public ReceiptAllocation(Guid receiptVoucherId, Guid invoiceId, decimal amountApplied)
    {
        Id               = Guid.NewGuid();
        ReceiptVoucherId = receiptVoucherId;
        InvoiceId        = invoiceId;
        AmountApplied    = amountApplied;
    }

    public Guid    Id               { get; private set; }
    public Guid    ReceiptVoucherId { get; private set; }
    public Guid    InvoiceId        { get; private set; }
    public decimal AmountApplied    { get; private set; }

    public ReceiptVoucher? ReceiptVoucher { get; private set; }
    public Invoice?        Invoice        { get; private set; }
}
