namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// A template that auto-generates invoices on a schedule (weekly / monthly /
/// quarterly / yearly). A background job (and a manual trigger) materialises a
/// real <see cref="Invoice"/> whenever <see cref="NextRunDate"/> is due.
/// </summary>
public sealed class RecurringInvoice
{
    private RecurringInvoice() { }

    public RecurringInvoice(
        string templateName, string customerName, string? customerEmail,
        string frequency, DateTime startDate, DateTime? endDate,
        int dueDays, decimal taxRate, string? notes,
        string? ccEmails = null, bool autoSend = true)
    {
        Id            = Guid.NewGuid();
        TemplateName  = templateName.Trim();
        CustomerName  = customerName.Trim();
        CustomerEmail = customerEmail?.Trim().ToLowerInvariant();
        Frequency     = frequency;          // weekly | monthly | quarterly | yearly
        StartDate     = startDate.Date;
        EndDate       = endDate?.Date;
        NextRunDate   = startDate.Date;
        DueDays       = dueDays <= 0 ? 30 : dueDays;
        TaxRate       = taxRate;
        Notes         = notes?.Trim();
        CcEmails      = Normalise(ccEmails);
        AutoSend      = autoSend;
        IsActive      = true;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id                 { get; private set; }
    public string    TemplateName       { get; private set; } = string.Empty;
    public string    CustomerName       { get; private set; } = string.Empty;
    public string?   CustomerEmail      { get; private set; }
    public string    Frequency          { get; private set; } = "monthly";
    public DateTime  StartDate          { get; private set; }
    public DateTime? EndDate            { get; private set; }
    public DateTime  NextRunDate        { get; private set; }
    public int       DueDays            { get; private set; } = 30;
    public decimal   TaxRate            { get; private set; }
    public string?   Notes              { get; private set; }
    /// <summary>Comma-separated addresses copied on every invoice from this template.</summary>
    public string?   CcEmails           { get; private set; }

    /// <summary>Email the invoice the moment it is generated. Off means it is created as a draft
    /// for someone to review and send by hand — worth using for a first client before letting a
    /// template run unattended.</summary>
    public bool      AutoSend           { get; private set; } = true;

    public bool      IsActive           { get; private set; }
    public DateTime? LastGeneratedDate  { get; private set; }
    public int       GeneratedCount     { get; private set; }
    public DateTime  CreatedAt          { get; private set; }
    public DateTime? UpdatedAt          { get; private set; }
    public bool      IsDeleted          { get; private set; }

    public ICollection<RecurringInvoiceLine> Lines { get; private set; } = new List<RecurringInvoiceLine>();

    public bool IsDue(DateTime asOf) =>
        IsActive && !IsDeleted && NextRunDate.Date <= asOf.Date
        && (EndDate is null || NextRunDate.Date <= EndDate.Value.Date);

    public static DateTime ComputeNext(DateTime from, string frequency) => frequency.ToLowerInvariant() switch
    {
        "weekly"    => from.AddDays(7),
        "quarterly" => from.AddMonths(3),
        "yearly"    => from.AddYears(1),
        _           => from.AddMonths(1),   // monthly default
    };

    /// <summary>Advance the schedule after an invoice was generated for the current run date.</summary>
    public void AdvanceAfterGeneration()
    {
        LastGeneratedDate = NextRunDate;
        GeneratedCount++;
        NextRunDate = ComputeNext(NextRunDate, Frequency);
        if (EndDate is not null && NextRunDate.Date > EndDate.Value.Date) IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string templateName, string customerName, string? customerEmail,
        string frequency, DateTime? endDate, int dueDays, decimal taxRate, string? notes,
        string? ccEmails = null, bool autoSend = true)
    {
        TemplateName  = templateName.Trim();
        CustomerName  = customerName.Trim();
        CustomerEmail = customerEmail?.Trim().ToLowerInvariant();
        Frequency     = frequency;
        EndDate       = endDate?.Date;
        DueDays       = dueDays <= 0 ? 30 : dueDays;
        TaxRate       = taxRate;
        Notes         = notes?.Trim();
        CcEmails      = Normalise(ccEmails);
        AutoSend      = autoSend;
        UpdatedAt     = DateTime.UtcNow;
    }

    /// <summary>Addresses to copy, split on comma or semicolon and de-duplicated — one stray
    /// separator would otherwise produce "a@x.com;b@y.com" as a single address no server accepts.</summary>
    public IReadOnlyList<string> CcList =>
        (CcEmails ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static string? Normalise(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? null
            : string.Join(",", csv
                .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase));

    public void Pause()  { IsActive = false; UpdatedAt = DateTime.UtcNow; }
    public void Resume() { IsActive = true;  UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class RecurringInvoiceLine
{
    private RecurringInvoiceLine() { }

    public RecurringInvoiceLine(Guid recurringInvoiceId, string description, decimal quantity, decimal unitPrice)
    {
        Id                 = Guid.NewGuid();
        RecurringInvoiceId = recurringInvoiceId;
        Description        = description.Trim();
        Quantity           = quantity;
        UnitPrice          = unitPrice;
    }

    public Guid    Id                 { get; private set; }
    public Guid    RecurringInvoiceId { get; private set; }
    public string  Description        { get; private set; } = string.Empty;
    public decimal Quantity           { get; private set; }
    public decimal UnitPrice          { get; private set; }

    public RecurringInvoice? RecurringInvoice { get; private set; }
}
