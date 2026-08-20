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
    DateTime CreatedAt);

/// <summary>The bytes plus what a browser needs to render/save them.</summary>
public sealed record CrmDocumentContentDto(
    byte[] Data,
    string FileName,
    string ContentType);
