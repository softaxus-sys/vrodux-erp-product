using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Projects.Dtos;

namespace Softaxis.ProjectManagement.Application.Projects.Commands;

/// <summary>Creates a new project, deriving a unique uppercase key and seeding default board columns.</summary>
public sealed record CreateProjectCommand(
    string  Name,
    string? Description = null,
    string? LeadName    = null
) : ICommand<ProjectDto>;

public sealed class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be ≤ 200 characters.");

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithMessage("Description must be ≤ 2000 characters.");

        RuleFor(x => x.LeadName)
            .MaximumLength(200).WithMessage("Lead name must be ≤ 200 characters.");
    }
}
