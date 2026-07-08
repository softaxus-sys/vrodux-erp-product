namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// A visa consultancy case — the aggregate root of the Visa Services module. Tracks one
/// engagement (e.g. "Employment visa — new" for one primary applicant + dependents) from
/// intake through document collection, government submission, and outcome.
/// Status machine (enforced in <see cref="ChangeStatus"/>):
/// draft → docs_pending → docs_complete → submitted → in_review → approved → issued → closed;
/// submitted/in_review can branch to rfi_required (back to docs_pending) or rejected.
/// </summary>
public sealed class VisaCase
{
    public static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["draft"]          = ["docs_pending", "cancelled"],
        ["docs_pending"]   = ["docs_complete", "cancelled"],
        ["docs_complete"]  = ["submitted", "docs_pending", "cancelled"],
        ["submitted"]      = ["in_review", "rfi_required", "rejected", "cancelled"],
        ["in_review"]      = ["approved", "rfi_required", "rejected"],
        ["rfi_required"]   = ["docs_pending", "submitted", "cancelled"],
        ["approved"]       = ["issued"],
        ["issued"]         = ["closed"],
        ["rejected"]       = ["docs_pending", "closed"],   // re-work or give up
        ["cancelled"]      = [],
        ["closed"]         = [],
    };

    private VisaCase() { }

    public VisaCase(Guid visaTypeId, string visaTypeName, string channel, string emirate,
        string? customerName, Guid? customerId, string priority, string assignedTo,
        decimal serviceFee, decimal govtFee, string? slaDueDate, string? notes)
    {
        Id            = Guid.NewGuid();
        CaseNumber    = $"VC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        VisaTypeId    = visaTypeId;
        VisaTypeName  = visaTypeName.Trim();
        Channel       = channel;
        Emirate       = emirate.Trim();
        CustomerName  = customerName?.Trim();
        CustomerId    = customerId;
        Status        = "draft";
        Priority      = string.IsNullOrWhiteSpace(priority) ? "medium" : priority;
        AssignedTo    = assignedTo.Trim();
        ServiceFee    = serviceFee;
        GovtFee       = govtFee;
        SlaDueDate    = slaDueDate;
        Notes         = notes?.Trim();
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public string    CaseNumber   { get; private set; } = string.Empty;
    public Guid      VisaTypeId   { get; private set; }
    // Denormalized for list rendering (same pattern as Deal.Company).
    public string    VisaTypeName { get; private set; } = string.Empty;
    // Submission channel key: manual | gdrfa | icp | mohre (adapters land in later phases).
    public string    Channel      { get; private set; } = "manual";
    public string    Emirate      { get; private set; } = string.Empty;
    // Optional link to the CRM account (relational, like Deal.CustomerId).
    public Guid?     CustomerId   { get; private set; }
    public string?   CustomerName { get; private set; }
    public string    Status       { get; private set; } = "draft";
    public string    Priority     { get; private set; } = "medium";
    public string    AssignedTo   { get; private set; } = string.Empty;
    public decimal   ServiceFee   { get; private set; }
    public decimal   GovtFee      { get; private set; }
    // Reference number from the government portal (typed in by the PRO in manual mode).
    public string?   GovtReference   { get; private set; }
    // Expiry of the issued residence/entry visa (yyyy-MM-dd) — set when a case is issued;
    // drives the Renewals page + dashboard expiry counts.
    public string?   VisaExpiryDate  { get; private set; }
    public string?   SlaDueDate      { get; private set; }
    public string?   RejectionReason { get; private set; }
    public string?   Notes        { get; private set; }
    // Link to the draft invoice raised in Finance for this case's fees (cross-service —
    // the invoice lives in the Finance schema; we store only its id + number for display).
    public Guid?     InvoiceId     { get; private set; }
    public string?   InvoiceNumber { get; private set; }
    public bool      IsDeleted    { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    /// <summary>Returns false when the transition is not allowed by the status machine.</summary>
    public bool ChangeStatus(string next, string? rejectionReason = null)
    {
        if (!Transitions.TryGetValue(Status, out var allowed) || !allowed.Contains(next)) return false;
        Status = next;
        RejectionReason = next == "rejected" ? rejectionReason?.Trim() : null;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public void Assign(string assignedTo) { AssignedTo = assignedTo.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void LinkInvoice(Guid invoiceId, string? invoiceNumber) { InvoiceId = invoiceId; InvoiceNumber = invoiceNumber?.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void SetGovtReference(string? reference) { GovtReference = reference?.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void SetVisaExpiry(string? expiryDate) { VisaExpiryDate = string.IsNullOrWhiteSpace(expiryDate) ? null : expiryDate.Trim(); UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void Update(string emirate, string? customerName, Guid? customerId, string priority,
        decimal serviceFee, decimal govtFee, string? slaDueDate, string? notes)
    {
        Emirate = emirate.Trim(); CustomerName = customerName?.Trim(); CustomerId = customerId;
        Priority = priority; ServiceFee = serviceFee; GovtFee = govtFee;
        SlaDueDate = slaDueDate; Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
