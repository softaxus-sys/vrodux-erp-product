using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Recruitment.Dtos;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record CreateApplicantCommand(
    Guid    JobId,
    string  Name,
    string  Email,
    string? Phone,
    string? Nationality,
    string? CurrentRole,
    string? CurrentCompany,
    int     Experience,
    string? Source,
    string? Notes
) : ICommand<ApplicantDto>;

public sealed class CreateApplicantValidator : AbstractValidator<CreateApplicantCommand>
{
    public CreateApplicantValidator()
    {
        RuleFor(x => x.JobId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
        RuleFor(x => x.Email).NotEmpty().EmailAddress().WithMessage("A valid email is required.");
    }
}
