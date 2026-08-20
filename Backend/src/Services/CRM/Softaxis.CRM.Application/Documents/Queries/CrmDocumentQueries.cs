using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Documents.Dtos;

namespace Softaxis.CRM.Application.Documents.Queries;

/// <summary>All documents attached to one CRM record, newest first. Metadata only — no bytes.</summary>
public sealed record GetCrmDocumentsQuery(string RelatedToType, Guid RelatedToId)
    : IQuery<IReadOnlyList<CrmDocumentDto>>;

/// <summary>The file bytes for a single document, for download / preview.</summary>
public sealed record GetCrmDocumentContentQuery(Guid Id) : IQuery<CrmDocumentContentDto>;

/// <summary>
/// Tenant-wide document library — every attachment across leads, opportunities, accounts and
/// contacts, so a user can find "all signed contracts" without opening records one by one.
/// All filters are optional and combine with AND.
/// </summary>
public sealed record SearchCrmDocumentsQuery(
    string? Search,
    string? DocumentType,
    string? RelatedToType) : IQuery<IReadOnlyList<CrmDocumentDto>>;
