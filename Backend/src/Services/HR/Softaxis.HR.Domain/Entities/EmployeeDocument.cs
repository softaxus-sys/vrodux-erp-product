namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// A file attached to an employee — passport and visa copies, the signed contract, certificates,
/// medical insurance cards.
///
/// <para><b>Bytes are stored in the database</b>, following the CRM document and expense-receipt
/// precedent, so the on-prem deployment needs no blob store. <see cref="Data"/> must never be
/// selected in list queries: the read handler projects metadata only, and only the download
/// handler loads the bytes.</para>
///
/// <para><see cref="ExpiryDate"/> is what makes this more than a file cabinet — passports, visas
/// and insurance all expire, and HR needs to see what is lapsing.</para>
/// </summary>
public sealed class EmployeeDocument
{
    private EmployeeDocument() { }

    public EmployeeDocument(
        Guid    employeeId,
        string  fileName,
        string  contentType,
        byte[]  data,
        string  documentType,
        string? description,
        string? expiryDate,
        Guid?   uploadedByUserId,
        string? uploadedByName)
    {
        Id               = Guid.NewGuid();
        EmployeeId       = employeeId;
        FileName         = fileName.Trim();
        ContentType      = contentType.Trim();
        Data             = data;
        SizeBytes        = data.LongLength;
        DocumentType     = documentType.Trim().ToLowerInvariant();
        Description      = description?.Trim();
        ExpiryDate       = string.IsNullOrWhiteSpace(expiryDate) ? null : expiryDate.Trim();
        UploadedByUserId = uploadedByUserId;
        UploadedByName   = uploadedByName?.Trim();
        CreatedAt        = DateTime.UtcNow;
    }

    public Guid      Id               { get; private set; }
    public Guid      EmployeeId       { get; private set; }
    public string    FileName         { get; private set; } = string.Empty;
    public string    ContentType      { get; private set; } = string.Empty;
    public byte[]    Data             { get; private set; } = [];
    public long      SizeBytes        { get; private set; }
    /// <summary>passport | visa | emirates_id | contract | certificate | insurance | other</summary>
    public string    DocumentType     { get; private set; } = "other";
    public string?   Description      { get; private set; }
    /// <summary>yyyy-MM-dd, matching the string-date convention used across HR.</summary>
    public string?   ExpiryDate       { get; private set; }
    public Guid?     UploadedByUserId { get; private set; }
    public string?   UploadedByName   { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public bool      IsDeleted        { get; private set; }

    public void Update(string documentType, string? description, string? expiryDate)
    {
        DocumentType = documentType.Trim().ToLowerInvariant();
        Description  = description?.Trim();
        ExpiryDate   = string.IsNullOrWhiteSpace(expiryDate) ? null : expiryDate.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
