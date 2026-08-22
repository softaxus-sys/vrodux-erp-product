namespace Softaxis.CRM.Application.Documents.Dtos;

/// <summary>
/// Document metadata. Deliberately excludes the file bytes — lists must never carry them;
/// use the download endpoint for content.
/// </summary>
public sealed record CrmDocumentDto(
    Guid     Id,
    string   RelatedToType,
    Guid     RelatedToId,
    string?  RelatedToName,
    string   FileName,
    string   ContentType,
    long     SizeBytes,
    string   DocumentType,
    string?  Description,
    string?  UploadedByName,
    DateTime CreatedAt,
    /// <summary>
    /// Owner of the record the document hangs off — the rep whose lead/opportunity/account this is,
    /// not whoever uploaded the file. This is what the File Manager groups folders by: a manager
    /// uploading a contract onto a rep's deal must still file under that rep, or the rep's folder
    /// understates their own book. Null when the linked record is unassigned.
    /// </summary>
    Guid?    OwnerUserId = null,
    string?  OwnerName   = null);

/// <summary>The bytes plus what a browser needs to render/save them.</summary>
public sealed record CrmDocumentContentDto(
    byte[] Data,
    string FileName,
    string ContentType);
