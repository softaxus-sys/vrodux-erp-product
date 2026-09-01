using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Healthcare.Dtos;

namespace Softaxis.CRM.Application.Healthcare.Queries;

public sealed record GetHealthcareSummaryQuery : IQuery<HealthcareSummaryDto>;

public sealed record GetPatientsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<PatientDto>>;

public sealed record GetAppointmentsQuery(
    Guid?   PatientId = null,
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<AppointmentDto>>;

public sealed record GetTreatmentPlansQuery(
    Guid?   PatientId = null,
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<TreatmentPlanDto>>;
