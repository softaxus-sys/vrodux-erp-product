using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Healthcare.Dtos;

namespace Softaxis.CRM.Application.Healthcare.Queries;

public sealed record GetHealthcareSummaryQuery : IQuery<HealthcareSummaryDto>;

public sealed record GetPatientsQuery : IQuery<IReadOnlyList<PatientDto>>;

public sealed record GetAppointmentsQuery(Guid? PatientId) : IQuery<IReadOnlyList<AppointmentDto>>;

public sealed record GetTreatmentPlansQuery(Guid? PatientId) : IQuery<IReadOnlyList<TreatmentPlanDto>>;
