namespace Softaxis.Trade.Domain.Entities;

public static class DocumentType
{
    public static readonly string[] All =
    [
        "commercial_invoice", "proforma_invoice", "packing_list", "bill_of_lading", "airway_bill",
        "certificate_of_origin", "customs_declaration", "insurance", "letter_of_credit",
        "inspection_certificate", "import_permit", "export_permit", "delivery_order", "other",
    ];
}

/// <summary>
/// A paper (or PDF) that travels with a shipment. The file is optional — a document can be
/// registered before it arrives — and carries an expiry where it has one (permits, certificates,
/// letters of credit), which the dashboard watches.
/// </summary>
public sealed class TradeDocument
{
    private TradeDocument() { }

    public TradeDocument(Guid shipmentId, string type, string? number, DateOnly? issueDate, DateOnly? expiryDate,
        string? notes, string? fileName, string? contentType, byte[]? content)
    {
        Id         = Guid.NewGuid();
        ShipmentId = shipmentId;
        Set(type, number, issueDate, expiryDate, notes);
        if (content is { Length: > 0 }) AttachFile(fileName, contentType, content);
    }

    public Guid      Id          { get; private set; }
    public Guid      ShipmentId  { get; private set; }
    public string    Type        { get; private set; } = "other";
    public string?   Number      { get; private set; }
    public DateOnly? IssueDate   { get; private set; }
    public DateOnly? ExpiryDate  { get; private set; }
    public string?   Notes       { get; private set; }
    public string?   FileName    { get; private set; }
    public string?   ContentType { get; private set; }
    public long      SizeBytes   { get; private set; }
    public byte[]?   Content     { get; private set; }
    public bool      IsDeleted   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string type, string? number, DateOnly? issueDate, DateOnly? expiryDate, string? notes)
    {
        Set(type, number, issueDate, expiryDate, notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void AttachFile(string? fileName, string? contentType, byte[] content)
    {
        FileName    = Text.OrNull(fileName) ?? "document";
        ContentType = Text.OrNull(contentType) ?? "application/octet-stream";
        Content     = content;
        SizeBytes   = content.LongLength;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; Content = null; UpdatedAt = DateTime.UtcNow; }

    private void Set(string type, string? number, DateOnly? issueDate, DateOnly? expiryDate, string? notes)
    {
        Type       = type;
        Number     = Text.OrNull(number);
        IssueDate  = issueDate;
        ExpiryDate = expiryDate;
        Notes      = Text.OrNull(notes);
    }
}

/// <summary>
/// Remembers the day the daily alert last went out for a workspace, so a restart or a second
/// sweep the same day cannot send it twice. One row per workspace.
/// </summary>
public sealed class TradeAlertState
{
    private TradeAlertState() { }

    public TradeAlertState(string lastDigestDate) { Id = Guid.NewGuid(); LastDigestDate = lastDigestDate; }

    public Guid      Id             { get; private set; }
    public string    LastDigestDate { get; private set; } = null!;
    public DateTime? UpdatedAt      { get; private set; }

    public void Mark(string date) { LastDigestDate = date; UpdatedAt = DateTime.UtcNow; }
}
