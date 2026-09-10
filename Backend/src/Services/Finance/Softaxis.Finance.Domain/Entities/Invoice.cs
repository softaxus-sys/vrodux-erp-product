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
        string? notes,
        string? ccEmails = null)
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
        CcEmails       = NormaliseCc(ccEmails);
        CreatedAt      = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    InvoiceNumber { get; private set; } = string.Empty;
    public Guid?     CustomerId    { get; private set; }
    public string    CustomerName  { get; private set; } = string.Empty;
    public string?   CustomerEmail { get; private set; }
    /// <summary>Buyer's billing address, printed under "Bill To". Multi-line.</summary>
    public string?   CustomerAddress { get; private set; }
    /// <summary>Buyer's tax registration number (TRN#) — required on a UAE tax invoice when the buyer is VAT-registered.</summary>
    public string?   CustomerTrn   { get; private set; }
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

    // The payment receipt is a different message from the invoice, sent at a different moment, so
    // it gets its own record — reusing EmailSentAt would make it impossible to tell which was sent.
    public DateTime? ReceiptSentAt { get; private set; }
    public string?   ReceiptSentTo { get; private set; }
    public string?   EmailSentTo  { get; private set; }
    public string?   EmailCc      { get; private set; }

    /// <summary>
    /// The customer's own people to copy — their accounts inbox, whoever actually pays. Set on
    /// the invoice because invoices carry a free-text customer, not always a linked record.
    /// Distinct from <c>EmailCc</c>, which records who was <i>actually</i> copied on a send.
    /// </summary>
    public string?   CcEmails     { get; private set; }

    public IReadOnlyList<string> CcList =>
        (CcEmails ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>Accepts commas and semicolons because people paste from both.</summary>
    private static string? NormaliseCc(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? null : string.Join(", ",
            raw.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
               .Select(x => x.ToLowerInvariant())
               .Distinct(StringComparer.OrdinalIgnoreCase));

    /// <summary>
    /// Send this invoice automatically on this date (yyyy-MM-dd), rather than pressing Send.
    /// Cleared once it goes out, so it can never send twice.
    ///
    /// <para>A one-off. An invoice that should be raised again every month is a recurring template,
    /// which already exists and owns its own schedule — this is for an invoice that already exists
    /// and should reach the customer on a particular day.</para>
    /// </summary>
    public string?   ScheduledSendDate { get; private set; }

    /// <summary>
    /// Whether to chase the customer as the due date approaches. On by default, because that is why
    /// a due date is recorded — but switchable per invoice, since the only other way to stop an
    /// automated chaser going to a client would be to cancel the invoice.
    /// </summary>
    public bool      RemindBeforeDue { get; private set; } = true;

    /// <summary>
    /// The rung of the reminder ladder already sent, as days before the due date. Null means none.
    /// Idempotency for the daily sweep — without it the customer is chased every single day.
    /// Same approach as Tenant.LastTrialReminderDaysLeft rather than a whole log table.
    /// </summary>
    public int?      LastReminderDaysBefore { get; private set; }

    /// <summary>When the last due-date reminder actually left, for the delivery trail.</summary>
    public DateTime? LastReminderSentAt { get; private set; }

    public Guid?     JournalEntryId { get; private set; }
    public Guid?     PaymentJournalEntryId { get; private set; }

    public ICollection<InvoiceItem> Items { get; private set; } = new List<InvoiceItem>();

    public decimal SubTotal  => Items.Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxAmount => SubTotal * TaxRate / 100;
    public decimal Total     => SubTotal + TaxAmount;
    public decimal AmountDue => Total - AmountPaid;

    public void Update(string customerName, string? customerEmail, string invoiceDate, string dueDate, decimal taxRate, string? notes, string status, string? ccEmails = null)
    {
        CustomerName  = customerName.Trim();
        CustomerEmail = customerEmail?.Trim().ToLowerInvariant();
        InvoiceDate   = invoiceDate;
        DueDate       = dueDate;
        TaxRate       = taxRate;
        Notes         = notes?.Trim();
        CcEmails      = NormaliseCc(ccEmails);
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

    /// <summary>Records that the payment receipt reached the customer. Only called after the mail
    /// server accepted it.</summary>
    public void RecordReceiptSent(string toEmail)
    {
        ReceiptSentAt = DateTime.UtcNow;
        ReceiptSentTo = toEmail;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status    = "cancelled";
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Returns the invoice to draft so it can be corrected and re-issued.
    ///
    /// <para>Clears the payment figures, because a draft that still reports money received would
    /// misstate the receivable. The caller is responsible for reversing the ledger first — this
    /// method only moves the invoice, it does not know about journal entries.</para>
    ///
    /// <para>The delivery record (EmailSentAt / ReceiptSentAt) is deliberately NOT cleared: an email
    /// that was sent is a historical fact, and erasing it would leave no way to tell that the
    /// customer already holds an earlier version of this invoice.</para>
    /// </summary>
    /// <summary>Schedules (or clears) the automatic send. Null cancels a pending one.</summary>
    public void SetScheduledSend(string? date)
    {
        ScheduledSendDate = string.IsNullOrWhiteSpace(date) ? null : date.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Clears the schedule once the invoice has gone out, so it cannot send again.</summary>
    public void ClearScheduledSend()
    {
        ScheduledSendDate = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetRemindBeforeDue(bool remind)
    {
        RemindBeforeDue = remind;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Records which rung of the ladder was sent, so the next sweep does not repeat it.</summary>
    public void RecordDueReminder(int daysBefore)
    {
        LastReminderDaysBefore = daysBefore;
        LastReminderSentAt     = DateTime.UtcNow;
        UpdatedAt              = DateTime.UtcNow;
    }

    public void ResetToDraft()
    {
        Status     = "draft";
        AmountPaid = 0;
        PaidAt     = null;
        // The ladder starts again: this invoice is about to be corrected and re-issued, possibly
        // with a different due date, so a rung sent against the old one means nothing.
        LastReminderDaysBefore = null;
        UpdatedAt  = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void SetCustomerId(Guid? customerId) { CustomerId = customerId; UpdatedAt = DateTime.UtcNow; }

    public void SetCustomerTaxDetails(string? address, string? trn)
    {
        CustomerAddress = string.IsNullOrWhiteSpace(address) ? null : address.Trim();
        CustomerTrn     = string.IsNullOrWhiteSpace(trn) ? null : trn.Trim();
        UpdatedAt       = DateTime.UtcNow;
    }

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
