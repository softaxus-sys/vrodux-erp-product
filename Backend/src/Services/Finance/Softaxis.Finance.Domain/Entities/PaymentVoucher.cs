namespace Softaxis.Finance.Domain.Entities;

public sealed class PaymentVoucher
{
    private PaymentVoucher() { }

    public PaymentVoucher(
        Guid    supplierId,
        string  supplierName,
        string  paymentDate,
        decimal amount,
        string? paymentMethod,
        Guid?   bankAccountId,
        string? reference,
        string? notes)
    {
        Id            = Guid.NewGuid();
        VoucherNumber = $"PV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        SupplierId    = supplierId;
        SupplierName  = supplierName.Trim();
        PaymentDate   = paymentDate;
        Amount        = amount;
        PaymentMethod = paymentMethod?.Trim();
        BankAccountId = bankAccountId;
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        Status        = "draft";  // draft | posted | void
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    VoucherNumber { get; private set; } = string.Empty;
    public Guid      SupplierId    { get; private set; }
    public string    SupplierName  { get; private set; } = string.Empty;
    public string    PaymentDate   { get; private set; } = string.Empty;
    public decimal   Amount        { get; private set; }
    public string?   PaymentMethod { get; private set; }
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

    public ICollection<PaymentAllocation> Allocations { get; private set; } = new List<PaymentAllocation>();

    public decimal AllocatedTotal => Allocations.Sum(a => a.AmountApplied);

    public void Update(string supplierName, string paymentDate, decimal amount, string? paymentMethod,
        Guid? bankAccountId, string? reference, string? notes)
    {
        SupplierName  = supplierName.Trim();
        PaymentDate   = paymentDate;
        Amount        = amount;
        PaymentMethod = paymentMethod?.Trim();
        BankAccountId = bankAccountId;
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        UpdatedAt     = DateTime.UtcNow;
    }

    public void ReplaceAllocations(IEnumerable<PaymentAllocation> allocations)
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

public sealed class PaymentAllocation
{
    private PaymentAllocation() { }

    public PaymentAllocation(Guid paymentVoucherId, Guid billId, decimal amountApplied)
    {
        Id               = Guid.NewGuid();
        PaymentVoucherId = paymentVoucherId;
        BillId           = billId;
        AmountApplied    = amountApplied;
    }

    public Guid    Id               { get; private set; }
    public Guid    PaymentVoucherId { get; private set; }
    public Guid    BillId           { get; private set; }
    public decimal AmountApplied    { get; private set; }

    public PaymentVoucher? PaymentVoucher { get; private set; }
    public PurchaseBill?   Bill           { get; private set; }
}
