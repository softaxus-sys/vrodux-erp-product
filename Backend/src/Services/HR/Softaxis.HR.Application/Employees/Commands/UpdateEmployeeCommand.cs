using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Employees.Commands;

public sealed record UpdateEmployeeCommand(
    Guid    Id,
    string  FirstName,
    string  LastName,
    string  Email,
    string? Phone,
    string? JobTitle,
    Guid?   DepartmentId,
    string? DepartmentName,
    string  EmploymentType,
    decimal BasicSalary,
    string  JoiningDate,
    Guid?   ManagerId,
    string? Notes,
    string  Status,
    string? AvatarData = null,
    string? Nationality = null,
    string? EmiratesId = null,
    string? PassportNumber = null,
    string? VisaExpiry = null,
    string? ReportingTo = null,
    string? BankAccount = null,
    string? Iban = null,
    string? MedicalInsurance = null,

    /// <summary>MOHRE Person ID — the Employee Unique ID a WPS salary file must carry.</summary>
    string? LabourCardNumber = null,

    /// <summary>The 9-digit routing code of the bank the salary is paid into (WPS agent ID).</summary>
    string? BankRoutingCode = null,
    // A null AvatarData means "not supplied" (keep the existing photo), so clearing one needs
    // its own signal — otherwise Remove Photo silently does nothing on an edit.
    bool    RemoveAvatar = false
) : ICommand;

public sealed class UpdateEmployeeValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("First name is required.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Last name is required.");
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("A valid email is required.");
        RuleFor(x => x.JoiningDate).NotEmpty().WithMessage("Joining date is required.");

        // Photo travels as a data URI in the JSON body; cap it so a huge upload can't
        // blow past the request size limit (2 MB of bytes ≈ 2.8 M base64 chars).
        RuleFor(x => x.AvatarData)
            .Must(v => v!.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Photo must be an image.")
            .Must(v => v!.Length <= 2_800_000)
            .WithMessage("Photo must be 2 MB or smaller.")
            .When(x => !string.IsNullOrWhiteSpace(x.AvatarData));
    }
}
