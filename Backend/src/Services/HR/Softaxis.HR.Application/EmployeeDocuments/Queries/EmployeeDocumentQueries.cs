using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.EmployeeDocuments.Dtos;

namespace Softaxis.HR.Application.EmployeeDocuments.Queries;

public sealed record GetEmployeeDocumentsQuery(Guid EmployeeId)
    : IQuery<IReadOnlyList<EmployeeDocumentDto>>;

public sealed record GetEmployeeDocumentContentQuery(Guid EmployeeId, Guid DocumentId)
    : IQuery<EmployeeDocumentContentDto>;
