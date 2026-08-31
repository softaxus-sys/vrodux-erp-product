using Softaxis.BuildingBlocks.Domain.Multitenancy;

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
        Status         = "draft";  // draft | sent | partially_paid | paid | overdue | cancelled
        Notes          = notes?.Trim();
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    InvoiceNumber { get; private set; } = string.Empty;
    public Guid?     CustomerId    { get; private set; }
    public string    CustomerName  { get; private set; } = string.Empty;
    public string?   CustomerEmail { get; private set; }
    public string    InvoiceDate   { get; private set; } = string.Empty;
    public string    DueDate       { get; private set; } = string.Empty;
    public decimal   TaxRate       { get; private set; }
    public string    CurrencyCode  { get; private set; } = TenantCurrency.Resolve();
    public string    Status        { get; private set; } = "draft";
    public string?   Notes         { get; private set; }
    public DateTime? PaidAt        { get; private set; }
    public decimal   AmountPaid    { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }
    // Delivery record. "Sent" alone cannot distinguish an invoice a person marked sent by hand
    // from one the system actually emailed, which is the first thing anyone asks when a client
    // says they never received it.
    public DateTime? EmailSentAt  { get; private set; }
    public string?   EmailSentTo  { get; private set; }
    public string?   EmailCc      { get; private set; }

    public Guid?     JournalEntryId { get; private set; }
    public Guid?     PaymentJournalEntryId { get; private set; }

    public ICollection<InvoiceItem> Items { get; private set; } = new List<InvoiceItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxAmount => SubTotal * TaxRate / 100;
    public decimal Total     => SubTotal + TaxAmount;
    public decimal AmountDue => Total - AmountPaid;

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

    /// <summary>Records a real delivery and moves the invoice to sent. Only called after the mail
    /// server accepted it — a failed send must leave the invoice as it was, or the list would show
    /// "sent" for something nobody received.</summary>
    public void RecordEmailSent(string toEmail, string? cc)
    {
        EmailSentAt = DateTime.UtcNow;
        EmailSentTo = toEmail;
        EmailCc     = cc;
        if (Status == "draft") Status = "sent";
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void SetCustomerId(Guid? customerId) { CustomerId = customerId; UpdatedAt = DateTime.UtcNow; }

    public void SetJournalEntryId(Guid? journalEntryId) { JournalEntryId = journalEntryId; UpdatedAt = DateTime.UtcNow; }

    /// <summary>
    /// The cash-receipt entry (Dr Bank/Cash, Cr AR) posted when the invoice is settled via
    /// "mark as paid". Kept separate from <see cref="JournalEntryId"/> (the sales entry) so
    /// cancelling an invoice can reverse both without one overwriting the other.
    /// </summary>
    public void SetPaymentJournalEntryId(Guid? journalEntryId) { PaymentJournalEntryId = journalEntryId; UpdatedAt = DateTime.UtcNow; }

    public void RecordPayment(decimal amount)
    {
        AmountPaid += amount;
        if (AmountPaid >= Total)
        {
            Status = "paid";
            PaidAt = DateTime.UtcNow;
        }
        else
        {
            Status = "partially_paid";
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReversePayment(decimal amount)
    {
        AmountPaid = Math.Max(0, AmountPaid - amount);
        Status     = AmountPaid <= 0 ? "sent" : "partially_paid";
        if (Status != "paid") PaidAt = null;
        UpdatedAt  = DateTime.UtcNow;
    }
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
