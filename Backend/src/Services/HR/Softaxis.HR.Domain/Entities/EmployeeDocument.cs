namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// A file attached to an employee — passport and visa copies, the signed contract, certificates,
/// medical insurance cards.
///
/// <para>Bytes live in the shared object storage bucket (see IObjectStorage) once configured —
/// <see cref="ObjectKey"/> set, <see cref="Data"/> cleared. A row uploaded before object storage
/// was configured keeps its bytes in <see cref="Data"/> instead; the two are never both populated.
/// Either way, <see cref="Data"/> must never be selected in list queries: the read handler
/// projects metadata only, and only the download handler loads the bytes (from whichever of the
/// two actually holds them).</para>
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

    /// <summary>Legacy storage — null/empty once ObjectKey is set (see SetObjectKey). Never both
    /// populated, so the bytes aren't paid for twice.</summary>
    public byte[]    Data             { get; private set; } = [];

    /// <summary>Key in the shared object storage bucket (see IObjectStorage), e.g.
    /// "hr/{tenantId}/{employeeId}/{documentId}". Null for a row stored the legacy way.</summary>
    public string?   ObjectKey        { get; private set; }

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

    /// <summary>Called once the bytes have actually landed in the bucket. Clears Data — the two
    /// storage locations are never both populated for the same row.</summary>
    public void SetObjectKey(string key)
    {
        ObjectKey = key;
        Data = [];
    }
}
