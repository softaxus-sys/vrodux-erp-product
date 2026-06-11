using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Careers.Dtos;

namespace Softaxis.HR.Application.Careers.Commands;

public sealed record ApplyToJobCommand(
    string   TenantSlug,
    Guid     JobId,
    string   Name,
    string   Email,
    string?  Phone,
    string?  Nationality,
    string?  CurrentRole,
    string?  CurrentCompany,
    int?     Experience,
    string?  CoverNote,
    ResumeUploadDto? Resume,
    string   AppDataRoot
) : ICommand<ApplyResultDto>;

public sealed class ApplyToJobValidator : AbstractValidator<ApplyToJobCommand>
{
    private const long MaxResumeBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] AllowedResumeExtensions = [".pdf", ".doc", ".docx"];

    public ApplyToJobValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name and email are required.");
        RuleFor(x => x.Email).NotEmpty().WithMessage("Name and email are required.");

        RuleFor(x => x.Resume)
            .Must(r => AllowedResumeExtensions.Contains(r!.Extension.ToLowerInvariant()))
            .WithMessage("Resume must be a PDF or Word document.")
            .When(x => x.Resume is not null);

        RuleFor(x => x.Resume)
            .Must(r => r!.Length <= MaxResumeBytes)
            .WithMessage("Resume must be 5 MB or smaller.")
            .When(x => x.Resume is not null);
    }
}
