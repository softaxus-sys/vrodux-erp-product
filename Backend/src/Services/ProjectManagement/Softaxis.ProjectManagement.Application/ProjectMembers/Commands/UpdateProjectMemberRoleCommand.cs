using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;

namespace Softaxis.ProjectManagement.Application.ProjectMembers.Commands;

/// <summary>Changes a project member's role.</summary>
public sealed record UpdateProjectMemberRoleCommand(Guid ProjectId, Guid MemberId, string Role) : ICommand<ProjectMemberDto>;

public sealed class UpdateProjectMemberRoleCommandValidator : AbstractValidator<UpdateProjectMemberRoleCommand>
{
    public UpdateProjectMemberRoleCommandValidator()
    {
        RuleFor(x => x.Role)
            .Must(r => r is "owner" or "member" or "viewer")
            .WithMessage("Role must be 'owner', 'member', or 'viewer'.");
    }
}
