using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Education.Dtos;

namespace Softaxis.CRM.Application.Education.Queries;

public sealed record GetEducationSummaryQuery : IQuery<EducationSummaryDto>;

public sealed record GetAdmissionsQuery : IQuery<IReadOnlyList<AdmissionDto>>;

public sealed record GetStudentsQuery : IQuery<IReadOnlyList<StudentDto>>;

public sealed record GetEnrollmentsQuery(Guid? StudentId) : IQuery<IReadOnlyList<EnrollmentDto>>;
