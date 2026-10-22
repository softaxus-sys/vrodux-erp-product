namespace Softaxis.Finance.Domain.Entities;

/// <summary>Lifecycle of one attempt to send an invoice to the Accredited Service Provider.</summary>
public static class EInvoiceStatus
{
    /// <summary>Claimed and being sent. Holds the invoice's slot so a second click cannot send twice.</summary>
    public const string Sending  = "sending";
    /// <summary>The ASP took the document (2xx). Not the same as "the FTA cleared it".</summary>
    public const string Accepted = "accepted";
    /// <summary>The ASP refused the document (4xx) — fix the data and send again.</summary>
    public const string Rejected = "rejected";
    /// <summary>Transport failure, timeout or 5xx — nothing is known to have arrived; safe to retry.</summary>
    public const string Failed   = "failed";
    /// <summary>No ASP is configured; recorded so the attempt is visible, never claimed as sent.</summary>
    public const string NotConfigured = "not_configured";
}

/// <summary>
/// One attempt to deliver an invoice as a UAE PINT AE e-invoice. Append-only history: a retry is a
/// new row. At most one row per invoice is <see cref="IsActive"/> (sending or accepted), enforced
/// by a filtered unique index, so the same invoice can never be in flight or accepted twice.
///
/// <para>The exact XML sent is kept (<see cref="XmlSnapshot"/>). An e-invoice is a legal document;
/// regenerating it later from data that may since have changed would not reproduce what the
/// customer and the FTA actually received.</para>
/// </summary>
public sealed class EInvoiceSubmission
{
    private EInvoiceSubmission() { }

    public EInvoiceSubmission(Guid invoiceId, string invoiceNumber, string xml, string provider,
        string environment, string? submittedByUserId, string? submittedByName)
    {
        Id                = Guid.NewGuid();
        InvoiceId         = invoiceId;
        InvoiceNumber     = invoiceNumber;
        XmlSnapshot       = xml;
        Provider          = provider;
        Environment       = environment;
        Status            = EInvoiceStatus.Sending;
        IsActive          = true;
        SubmittedByUserId = submittedByUserId;
        SubmittedByName   = submittedByName;
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public Guid      InvoiceId         { get; private set; }
    public string    InvoiceNumber     { get; private set; } = string.Empty;
    public string    XmlSnapshot       { get; private set; } = string.Empty;
    public string    Provider          { get; private set; } = string.Empty;
    /// <summary>"sandbox" or "production" — which ASP environment received it.</summary>
    public string    Environment       { get; private set; } = string.Empty;
    public string    Status            { get; private set; } = EInvoiceStatus.Sending;
    /// <summary>True while sending or accepted; drives the one-active-per-invoice unique index.</summary>
    public bool      IsActive          { get; private set; }
    /// <summary>The ASP's own id for the document, when its response carries one.</summary>
    public string?   ProviderMessageId { get; private set; }
    public int?      HttpStatus        { get; private set; }
    /// <summary>Bounded excerpt of the ASP response or error, for diagnosis.</summary>
    public string?   ResponseSnippet   { get; private set; }
    public string?   SubmittedByUserId { get; private set; }
    public string?   SubmittedByName   { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? CompletedAt       { get; private set; }

    public void Complete(string status, int? httpStatus, string? providerMessageId, string? snippet)
    {
        Status            = status;
        IsActive          = status == EInvoiceStatus.Accepted;
        HttpStatus        = httpStatus;
        ProviderMessageId = string.IsNullOrWhiteSpace(providerMessageId) ? null : providerMessageId.Trim();
        ResponseSnippet   = snippet is { Length: > 2000 } ? snippet[..2000] : snippet;
        CompletedAt       = DateTime.UtcNow;
    }
}
