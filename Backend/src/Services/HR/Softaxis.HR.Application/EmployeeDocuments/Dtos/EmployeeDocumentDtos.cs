namespace Softaxis.HR.Application.EmployeeDocuments.Dtos;

/// <summary>Metadata only — file bytes are never returned by a list query.</summary>
public sealed record EmployeeDocumentDto(
    Guid      Id,
    Guid      EmployeeId,
    string    FileName,
    string    ContentType,
    long      SizeBytes,
    string    DocumentType,
    string?   Description,
    string?   ExpiryDate,
    string?   UploadedByName,
    DateTime  CreatedAt);

/// <summary>The bytes plus what a browser needs to save them.</summary>
public sealed record EmployeeDocumentContentDto(
    byte[] Data,
    string FileName,
    string ContentType);
