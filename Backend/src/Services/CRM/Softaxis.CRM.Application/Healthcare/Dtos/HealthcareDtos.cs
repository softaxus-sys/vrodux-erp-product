namespace Softaxis.CRM.Application.Healthcare.Dtos;

public sealed record PatientDto(
    Guid Id, string PatientNumber, Guid? LeadId, Guid? CustomerId, string FullName, string Gender,
    string? DateOfBirth, string Phone, string? Email, string? BloodGroup, string? AssignedDoctor,
    string Status, string RegisteredDate, string? Notes, DateTime CreatedAt);

public sealed record AppointmentDto(
    Guid Id, string AppointmentNumber, Guid PatientId, string PatientName, string Doctor, string? Department,
    string ScheduledAt, string Status, string? Reason, string? Notes, DateTime CreatedAt);

public sealed record TreatmentPlanDto(
    Guid Id, Guid PatientId, string PatientName, string Diagnosis, string Plan, string Doctor,
    string StartDate, string? FollowUpDate, string Status, string? Notes, DateTime CreatedAt);

public sealed record HealthcareSummaryDto(
    int Patients, int ScheduledAppointments, int TodayAppointments, int CompletedAppointments, int ActiveTreatments);
