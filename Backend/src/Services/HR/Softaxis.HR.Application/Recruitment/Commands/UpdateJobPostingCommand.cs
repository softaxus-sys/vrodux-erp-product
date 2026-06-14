using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Recruitment.Commands;

public sealed record UpdateJobPostingCommand(
    Guid     Id,
    string   Title,
    string   Department,
    string   Branch,
    string   Type,
    string   ExperienceLevel,
    int      Headcount,
    decimal  SalaryMin,
    decimal  SalaryMax,
    string   Currency,
    string?  ClosingDate,
    string?  HiringManager,
    string   Description,
    IReadOnlyList<string>? Requirements,
    IReadOnlyList<string>? Responsibilities,
    string   Status
) : ICommand;

public sealed class UpdateJobPostingValidator : AbstractValidator<UpdateJobPostingCommand>
{
    private static readonly string[] ValidStatuses = ["draft", "open", "on_hold", "closed"];

    public UpdateJobPostingValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Title is required.");
        RuleFor(x => x.Department).NotEmpty().WithMessage("Department is required.");
        RuleFor(x => x.Branch).NotEmpty().WithMessage("Branch is required.");
        RuleFor(x => x.Description).NotEmpty().WithMessage("Description is required.");
        RuleFor(x => x.Status)
            .Must(s => ValidStatuses.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", ValidStatuses)}.");
    }
}
