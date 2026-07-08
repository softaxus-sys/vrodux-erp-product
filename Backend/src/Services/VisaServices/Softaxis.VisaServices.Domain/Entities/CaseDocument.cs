namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// One checklist item on a visa case (passport copy, photo, salary certificate…).
/// Rows are created from the visa type's RequiredDocuments template at case creation;
/// extra ad-hoc documents can be added later. Status: pending → received → verified,
/// with rejected/expired as failure states that put the case back into docs_pending.
/// </summary>
public sealed class CaseDocument
{
    private CaseDocument() { }

    public CaseDocument(Guid visaCaseId, Guid? applicantId, string name)
    {
        Id         = Guid.NewGuid();
        VisaCaseId = visaCaseId;
        ApplicantId = applicantId;
        Name       = name.Trim();
        Status     = "pending";
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      VisaCaseId  { get; private set; }
    // Null = case-level document; set = specific to one applicant (e.g. each passport).
    public Guid?     ApplicantId { get; private set; }
    public string    Name        { get; private set; } = string.Empty;
    // pending | received | verified | rejected | expired
    public string    Status      { get; private set; } = "pending";
    public string?   FileUrl     { get; private set; }
    public string?   ExpiryDate  { get; private set; }
    public string?   Notes       { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public void SetStatus(string status, string? notes)
    {
        Status = status; Notes = notes?.Trim(); UpdatedAt = DateTime.UtcNow;
    }

    public void AttachFile(string fileUrl, string? expiryDate)
    {
        FileUrl = fileUrl.Trim(); ExpiryDate = expiryDate;
        if (Status == "pending") Status = "received";
        UpdatedAt = DateTime.UtcNow;
    }
}
