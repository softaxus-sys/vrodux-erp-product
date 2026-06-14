using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Healthcare.Dtos;

namespace Softaxis.CRM.Application.Healthcare.Commands;

// ── Patients ─────────────────────────────────────────────────────────────────
public sealed record CreatePatientCommand(
    Guid? LeadId, Guid? CustomerId, string FullName, string? Gender, string? DateOfBirth,
    string? Phone, string? Email, string? BloodGroup, string? AssignedDoctor, string? Notes) : ICommand<PatientDto>;

public sealed class CreatePatientValidator : AbstractValidator<CreatePatientCommand>
{
    public CreatePatientValidator()
    {
        RuleFor(x => x.FullName).NotEmpty();
    }
}

public sealed record UpdatePatientCommand(
    Guid Id, string FullName, string? Gender, string? DateOfBirth, string? Phone, string? Email,
    string? BloodGroup, string? AssignedDoctor, string Status, string? Notes) : ICommand;

public sealed class UpdatePatientValidator : AbstractValidator<UpdatePatientCommand>
{
    public UpdatePatientValidator()
    {
        RuleFor(x => x.FullName).NotEmpty();
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record DeletePatientCommand(Guid Id) : ICommand;

// ── Appointments ─────────────────────────────────────────────────────────────
public sealed record CreateAppointmentCommand(
    Guid PatientId, string PatientName, string Doctor, string? Department, string ScheduledAt,
    string? Reason, string? Notes) : ICommand<AppointmentDto>;

public sealed class CreateAppointmentValidator : AbstractValidator<CreateAppointmentCommand>
{
    public CreateAppointmentValidator()
    {
        RuleFor(x => x.PatientName).NotEmpty();
        RuleFor(x => x.Doctor).NotEmpty();
        RuleFor(x => x.ScheduledAt).NotEmpty();
    }
}

public sealed record UpdateAppointmentStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteAppointmentCommand(Guid Id) : ICommand;

// ── Treatment Plans ────────────────────────────────────────────────────────────
public sealed record CreateTreatmentPlanCommand(
    Guid PatientId, string PatientName, string Diagnosis, string Plan, string Doctor,
    string StartDate, string? FollowUpDate, string? Notes) : ICommand<TreatmentPlanDto>;

public sealed class CreateTreatmentPlanValidator : AbstractValidator<CreateTreatmentPlanCommand>
{
    public CreateTreatmentPlanValidator()
    {
        RuleFor(x => x.PatientName).NotEmpty();
        RuleFor(x => x.Diagnosis).NotEmpty();
        RuleFor(x => x.Plan).NotEmpty();
        RuleFor(x => x.Doctor).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
    }
}

public sealed record UpdateTreatmentPlanStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteTreatmentPlanCommand(Guid Id) : ICommand;
