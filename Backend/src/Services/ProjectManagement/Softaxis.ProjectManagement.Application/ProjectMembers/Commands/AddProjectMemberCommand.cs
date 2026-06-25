using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;

namespace Softaxis.ProjectManagement.Application.ProjectMembers.Commands;

/// <summary>Adds a user to a project's team with the given role.</summary>
public sealed record AddProjectMemberCommand(
    Guid ProjectId,
    Guid UserId,
    string UserName,
    string? UserEmail,
    string Role
) : ICommand<ProjectMemberDto>;

public sealed class AddProjectMemberCommandValidator : AbstractValidator<AddProjectMemberCommand>
{
    public AddProjectMemberCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();

        RuleFor(x => x.UserName)
            .NotEmpty().WithMessage("User name is required.")
            .MaximumLength(200).WithMessage("User name must be ≤ 200 characters.");

        RuleFor(x => x.UserEmail)
            .MaximumLength(320).WithMessage("Email must be ≤ 320 characters.");

        RuleFor(x => x.Role)
            .Must(r => r is "owner" or "member" or "viewer")
            .WithMessage("Role must be 'owner', 'member', or 'viewer'.");
    }
}
