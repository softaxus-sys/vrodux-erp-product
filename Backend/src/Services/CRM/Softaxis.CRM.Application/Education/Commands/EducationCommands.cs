using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Education.Dtos;

namespace Softaxis.CRM.Application.Education.Commands;

// ── Admissions ────────────────────────────────────────────────────────────────
public sealed record CreateAdmissionCommand(
    Guid? LeadId, string ApplicantName, string Program, string? IntakeTerm,
    string? GuardianName, string? Phone, string? Email, string? Notes) : ICommand<AdmissionDto>;

public sealed class CreateAdmissionValidator : AbstractValidator<CreateAdmissionCommand>
{
    public CreateAdmissionValidator()
    {
        RuleFor(x => x.ApplicantName).NotEmpty();
        RuleFor(x => x.Program).NotEmpty();
    }
}

public sealed record UpdateAdmissionStatusCommand(Guid Id, string Status) : ICommand;

public sealed record EnrollAdmissionCommand(Guid Id) : ICommand<EnrollAdmissionResultDto>;

public sealed record DeleteAdmissionCommand(Guid Id) : ICommand;

// ── Students ─────────────────────────────────────────────────────────────────
public sealed record CreateStudentCommand(
    Guid? CustomerId, string FullName, string? Gender, string? Program,
    string? GuardianName, string? Phone, string? Email, string? Notes) : ICommand<StudentDto>;

public sealed class CreateStudentValidator : AbstractValidator<CreateStudentCommand>
{
    public CreateStudentValidator()
    {
        RuleFor(x => x.FullName).NotEmpty();
    }
}

public sealed record DeleteStudentCommand(Guid Id) : ICommand;

// ── Enrollments ──────────────────────────────────────────────────────────────
public sealed record CreateEnrollmentCommand(
    Guid StudentId, string StudentName, string Course, string? Term, decimal FeeTotal, string? Notes) : ICommand<EnrollmentDto>;

public sealed class CreateEnrollmentValidator : AbstractValidator<CreateEnrollmentCommand>
{
    public CreateEnrollmentValidator()
    {
        RuleFor(x => x.StudentName).NotEmpty();
        RuleFor(x => x.Course).NotEmpty();
    }
}

public sealed record RecordEnrollmentPaymentCommand(Guid Id, decimal Amount) : ICommand<EnrollmentDto>;

public sealed record UpdateEnrollmentStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteEnrollmentCommand(Guid Id) : ICommand;
