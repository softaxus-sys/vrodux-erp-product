using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Teams;

// ── DTOs ─────────────────────────────────────────────────────────────────────

/// <summary>
/// A user in a picker. <paramref name="Teams"/> lists every team they belong to — membership is
/// many-to-many, so an assigner can see that someone sits in more than one. Empty when the user is
/// in no team, or when the caller is looking at a list where team context does not apply.
/// </summary>
public sealed record TeamMemberDto(
    Guid UserId, string FullName, string Email, bool IsLead, IReadOnlyList<UserTeamRef>? Teams = null);

public sealed record TeamDto(
    Guid    Id,
    string  Name,
    string? Description,
    Guid?   TeamLeadUserId,
    string? TeamLeadName,
    bool    IsActive,
    IReadOnlyList<TeamMemberDto> Members);

// ── Queries ──────────────────────────────────────────────────────────────────

public sealed record GetTeamsQuery(string? Search = null) : IQuery<IReadOnlyList<TeamDto>>;

public sealed record GetTeamByIdQuery(Guid Id) : IQuery<TeamDto>;

// ── Commands ─────────────────────────────────────────────────────────────────

public sealed record CreateTeamCommand(
    string  Name,
    string? Description,
    Guid?   TeamLeadUserId,
    IReadOnlyList<Guid>? MemberUserIds) : ICommand<TeamDto>;

public sealed class CreateTeamCommandValidator : AbstractValidator<CreateTeamCommand>
{
    public CreateTeamCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed record UpdateTeamCommand(
    Guid    Id,
    string  Name,
    string? Description,
    Guid?   TeamLeadUserId,
    bool    IsActive) : ICommand<TeamDto>;

public sealed class UpdateTeamCommandValidator : AbstractValidator<UpdateTeamCommand>
{
    public UpdateTeamCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public sealed record AddTeamMemberCommand(Guid TeamId, Guid UserId) : ICommand<TeamDto>;

public sealed record RemoveTeamMemberCommand(Guid TeamId, Guid UserId) : ICommand<TeamDto>;

public sealed record DeleteTeamCommand(Guid Id) : ICommand;

/// <summary>
/// The users the caller may hand a lead to.
///
/// Admin (tenant-wide lead edit, or user administration) → every active user in the tenant.
/// Team lead → the members of the teams they lead. Anyone else → nobody, since they cannot reassign.
/// Keeps the full team roster from being readable by restricted users, which would undercut the
/// point of the tiers.
/// </summary>
public sealed record GetAssignableUsersQuery : IQuery<IReadOnlyList<TeamMemberDto>>;

/// <summary>Users eligible to lead a team — see ITeamRepository.GetTeamLeadCandidatesAsync.</summary>
public sealed record GetTeamLeadCandidatesQuery : IQuery<IReadOnlyList<TeamMemberDto>>;
