using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal static class HealthcareMappings
{
    public static PatientDto ToDto(Patient p) => new(
        p.Id, p.PatientNumber, p.LeadId, p.CustomerId, p.FullName, p.Gender, p.DateOfBirth, p.Phone,
        p.Email, p.BloodGroup, p.AssignedDoctor, p.Status, p.RegisteredDate, p.Notes, p.CreatedAt);

    public static AppointmentDto ToDto(Appointment a) => new(
        a.Id, a.AppointmentNumber, a.PatientId, a.PatientName, a.Doctor, a.Department,
        a.ScheduledAt, a.Status, a.Reason, a.Notes, a.CreatedAt);

    public static TreatmentPlanDto ToDto(TreatmentPlan p) => new(
        p.Id, p.PatientId, p.PatientName, p.Diagnosis, p.Plan, p.Doctor,
        p.StartDate, p.FollowUpDate, p.Status, p.Notes, p.CreatedAt);
}
