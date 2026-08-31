using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.Finance.Domain.Entities;

public sealed class Expense
{
    private Expense() { }

    public Expense(
        string  title,
        string  category,
        decimal amount,
        string  expenseDate,
        string? paidBy,
        string? paymentMethod,
        string? reference,
        string? notes)
    {
        Id            = Guid.NewGuid();
        ExpenseNumber = $"EXP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Title         = title.Trim();
        Category      = category.Trim();  // office | travel | utilities | salary | marketing | other
        Amount        = amount;
        ExpenseDate   = expenseDate;
        PaidBy        = paidBy?.Trim();
        PaymentMethod = paymentMethod?.Trim();  // cash | bank | card | cheque
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        Status        = "pending";  // pending | approved | rejected | paid
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    ExpenseNumber { get; private set; } = string.Empty;
    public Guid?     SupplierId    { get; private set; }
    public string    Title         { get; private set; } = string.Empty;
    public string    Category      { get; private set; } = string.Empty;
    public decimal   Amount        { get; private set; }
    public string    ExpenseDate   { get; private set; } = string.Empty;
    public string?   PaidBy        { get; private set; }
    public string?   PaymentMethod { get; private set; }
    public string?   Reference     { get; private set; }
    public string?   Notes         { get; private set; }
    public string    CurrencyCode  { get; private set; } = TenantCurrency.Resolve();
    public string    Status        { get; private set; } = "pending";
    public Guid?     ApprovedById  { get; private set; }
    public DateTime? ApprovedAt    { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }
    public Guid?     JournalEntryId { get; private set; }

    // Receipt attachment (stored in-DB; null when no receipt uploaded).
    public byte[]?   ReceiptData        { get; private set; }
    public string?   ReceiptFileName    { get; private set; }
    public string?   ReceiptContentType { get; private set; }
    public bool      HasReceipt => ReceiptData is { Length: > 0 };

    public void Update(string title, string category, decimal amount, string expenseDate,
        string? paidBy, string? paymentMethod, string? reference, string? notes)
    {
        Title         = title.Trim();
        Category      = category.Trim();
        Amount        = amount;
        ExpenseDate   = expenseDate;
        PaidBy        = paidBy?.Trim();
        PaymentMethod = paymentMethod?.Trim();
        Reference     = reference?.Trim();
        Notes         = notes?.Trim();
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Approve(Guid approverId)
    {
        Status       = "approved";
        ApprovedById = approverId;
        ApprovedAt   = DateTime.UtcNow;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Reject(Guid approverId)
    {
        Status       = "rejected";
        ApprovedById = approverId;
        ApprovedAt   = DateTime.UtcNow;
        UpdatedAt    = DateTime.UtcNow;
    }

    public void MarkPaid()
    {
        Status    = "paid";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void SetSupplierId(Guid? supplierId) { SupplierId = supplierId; UpdatedAt = DateTime.UtcNow; }

    public void SetJournalEntryId(Guid? journalEntryId) { JournalEntryId = journalEntryId; UpdatedAt = DateTime.UtcNow; }

    public void SetReceipt(byte[] data, string fileName, string contentType)
    {
        ReceiptData        = data;
        ReceiptFileName    = fileName.Trim();
        ReceiptContentType = contentType.Trim();
        UpdatedAt          = DateTime.UtcNow;
    }

    public void ClearReceipt()
    {
        ReceiptData        = null;
        ReceiptFileName    = null;
        ReceiptContentType = null;
        UpdatedAt          = DateTime.UtcNow;
    }
}
