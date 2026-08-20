namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// A file attached to a CRM record — contracts, proposals, signed agreements, ID copies, and so on.
///
/// <para>Polymorphic in exactly the same way as <see cref="Activity"/> (<c>RelatedToType</c> +
/// <c>RelatedToId</c>) so a document can hang off a lead, an opportunity, an account or a contact
/// without a separate table per owner. That is what makes attachments available at <b>every</b>
/// stage: the document travels with the record, and a lead's documents stay reachable after it is
/// converted because the converted account/opportunity can be queried in its own right.</para>
///
/// <para><b>Bytes are stored in the database</b>, following the existing receipt-attachment
/// precedent on <c>Expense</c>. That keeps the on-prem deployment free of any blob-store
/// dependency. <see cref="Data"/> must never be selected in list queries — the read handlers
/// project only metadata, and only the download handler loads the bytes.</para>
/// </summary>
public sealed class CrmDocument
{
    private CrmDocument() { }

    public CrmDocument(
        string  relatedToType,
        Guid    relatedToId,
        string? relatedToName,
        string  fileName,
        string  contentType,
        byte[]  data,
        string  documentType,
        string? description,
        Guid?   uploadedByUserId,
        string? uploadedByName)
    {
        Id               = Guid.NewGuid();
        RelatedToType    = relatedToType.Trim().ToLowerInvariant();  // lead | deal | customer | contact
        RelatedToId      = relatedToId;
        RelatedToName    = relatedToName?.Trim();
        FileName         = fileName.Trim();
        ContentType      = contentType.Trim();
        Data             = data;
        SizeBytes        = data.LongLength;
        DocumentType     = documentType.Trim().ToLowerInvariant();
        Description      = description?.Trim();
        UploadedByUserId = uploadedByUserId;
        UploadedByName   = uploadedByName?.Trim();
        CreatedAt        = DateTime.UtcNow;
    }

    public Guid      Id               { get; private set; }
    public string    RelatedToType    { get; private set; } = string.Empty;
    public Guid      RelatedToId      { get; private set; }
    public string?   RelatedToName    { get; private set; }
    public string    FileName         { get; private set; } = string.Empty;
    public string    ContentType      { get; private set; } = string.Empty;
    public byte[]    Data             { get; private set; } = [];
    public long      SizeBytes        { get; private set; }
    public string    DocumentType     { get; private set; } = "other";
    public string?   Description      { get; private set; }
    public Guid?     UploadedByUserId { get; private set; }
    public string?   UploadedByName   { get; private set; }
    public bool      IsDeleted        { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }

    /// <summary>Renames / re-categorises the document. The file content itself is immutable — re-upload to replace it.</summary>
    public void UpdateMetadata(string documentType, string? description)
    {
        DocumentType = documentType.Trim().ToLowerInvariant();
        Description  = description?.Trim();
        UpdatedAt    = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
