using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Education.Dtos;

namespace Softaxis.CRM.Application.Education.Queries;

public sealed record GetEducationSummaryQuery : IQuery<EducationSummaryDto>;

public sealed record GetAdmissionsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<AdmissionDto>>;

public sealed record GetStudentsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<StudentDto>>;

public sealed record GetEnrollmentsQuery(
    Guid?   StudentId = null,
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<EnrollmentDto>>;
