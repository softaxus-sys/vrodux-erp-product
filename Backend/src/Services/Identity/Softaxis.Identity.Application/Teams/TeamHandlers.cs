using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Teams;

/// <summary>
/// Teams are tenant-owned exactly like <see cref="Role"/>: every handler computes a
/// <c>tenantScope</c> (null for super-admins, the caller's tenant otherwise) and refuses to touch a
/// team outside it — returning NotFound rather than Forbidden so cross-tenant existence never leaks.
/// </summary>
internal static class TeamMapping
{
    public static async Task<TeamDto> ToDtoAsync(ITeamRepository repo, Team team, CancellationToken ct)
    {
        var ids = team.Members.Select(m => m.UserId).ToList();
        if (team.TeamLeadUserId is { } leadId && !ids.Contains(leadId)) ids.Add(leadId);

        var users = await repo.GetUsersAsync(ids, ct);
        TeamUserInfo? Lookup(Guid id) => users.FirstOrDefault(u => u.Id == id);

        var members = team.Members
            .Select(m =>
            {
                var u = Lookup(m.UserId);
                return new TeamMemberDto(m.UserId, u?.FullName ?? "", u?.Email ?? "", m.UserId == team.TeamLeadUserId);
            })
            .OrderByDescending(m => m.IsLead)
            .ThenBy(m => m.FullName)
            .ToList();

        return new TeamDto(
            team.Id, team.Name, team.Description, team.TeamLeadUserId,
            team.TeamLeadUserId is { } lid ? Lookup(lid)?.FullName : null,
            team.IsActive, members);
    }
}

/// <summary>Shared tenant-scope rule: super-admins operate on global teams, everyone else on their own tenant's.</summary>
internal static class TeamScope
{
    public static Guid? For(ICurrentUser user, ITenantContext tenant) =>
        user.IsSuperAdmin ? null : tenant.TenantId;
}

public sealed class GetTeamsQueryHandler(ITeamRepository repo, ICurrentUser currentUser, ITenantContext tenant)
    : IQueryHandler<GetTeamsQuery, IReadOnlyList<TeamDto>>
{
    public async Task<Result<IReadOnlyList<TeamDto>>> Handle(GetTeamsQuery query, CancellationToken ct)
    {
        var teams = await repo.GetAllAsync(TeamScope.For(currentUser, tenant), query.Search, ct);

        var dtos = new List<TeamDto>(teams.Count);
        foreach (var t in teams) dtos.Add(await TeamMapping.ToDtoAsync(repo, t, ct));

        return Result.Success<IReadOnlyList<TeamDto>>(dtos);
    }
}

public sealed class GetTeamByIdQueryHandler(ITeamRepository repo, ICurrentUser currentUser, ITenantContext tenant)
    : IQueryHandler<GetTeamByIdQuery, TeamDto>
{
    public async Task<Result<TeamDto>> Handle(GetTeamByIdQuery query, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);
        var team = await repo.GetByIdAsync(query.Id, ct);

        if (team is null || team.TenantId != scope)
            return Result.Failure<TeamDto>(Error.NotFoundById("Team", query.Id));

        return Result.Success(await TeamMapping.ToDtoAsync(repo, team, ct));
    }
}

public sealed class CreateTeamCommandHandler(ITeamRepository repo, IUnitOfWork uow, ICurrentUser currentUser, ITenantContext tenant)
    : ICommandHandler<CreateTeamCommand, TeamDto>
{
    public async Task<Result<TeamDto>> Handle(CreateTeamCommand cmd, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);

        if (await repo.NameExistsAsync(scope, cmd.Name, ct))
            return Result.Failure<TeamDto>(Error.Custom("Team.Duplicate", $"A team named “{cmd.Name.Trim()}” already exists."));

        var team = new Team(cmd.Name, cmd.Description, cmd.TeamLeadUserId, scope);

        // The lead is a member of their own team, so team-scoped queries need no special case.
        if (cmd.TeamLeadUserId is { } lead) team.AddMember(lead);
        foreach (var id in cmd.MemberUserIds ?? []) team.AddMember(id);

        repo.Add(team);
        await uow.SaveChangesAsync(ct);

        return Result.Success(await TeamMapping.ToDtoAsync(repo, team, ct));
    }
}

public sealed class UpdateTeamCommandHandler(ITeamRepository repo, IUnitOfWork uow, ICurrentUser currentUser, ITenantContext tenant)
    : ICommandHandler<UpdateTeamCommand, TeamDto>
{
    public async Task<Result<TeamDto>> Handle(UpdateTeamCommand cmd, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);
        var team = await repo.GetByIdAsync(cmd.Id, ct);

        if (team is null || team.TenantId != scope)
            return Result.Failure<TeamDto>(Error.NotFoundById("Team", cmd.Id));

        team.Update(cmd.Name, cmd.Description, cmd.TeamLeadUserId, cmd.IsActive);
        if (cmd.TeamLeadUserId is { } lead) team.AddMember(lead);

        await uow.SaveChangesAsync(ct);
        return Result.Success(await TeamMapping.ToDtoAsync(repo, team, ct));
    }
}

public sealed class AddTeamMemberCommandHandler(ITeamRepository repo, IUnitOfWork uow, ICurrentUser currentUser, ITenantContext tenant)
    : ICommandHandler<AddTeamMemberCommand, TeamDto>
{
    public async Task<Result<TeamDto>> Handle(AddTeamMemberCommand cmd, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);
        var team = await repo.GetByIdAsync(cmd.TeamId, ct);

        if (team is null || team.TenantId != scope)
            return Result.Failure<TeamDto>(Error.NotFoundById("Team", cmd.TeamId));

        // Only users of this tenant may join — otherwise a guessed id could pull another tenant's
        // user into the team and, via team scoping, expose this team's leads to them.
        if (!await repo.UserBelongsToTenantAsync(cmd.UserId, scope, ct))
            return Result.Failure<TeamDto>(Error.NotFoundById("User", cmd.UserId));

        team.AddMember(cmd.UserId);
        await uow.SaveChangesAsync(ct);
        return Result.Success(await TeamMapping.ToDtoAsync(repo, team, ct));
    }
}

public sealed class RemoveTeamMemberCommandHandler(ITeamRepository repo, IUnitOfWork uow, ICurrentUser currentUser, ITenantContext tenant)
    : ICommandHandler<RemoveTeamMemberCommand, TeamDto>
{
    public async Task<Result<TeamDto>> Handle(RemoveTeamMemberCommand cmd, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);
        var team = await repo.GetByIdAsync(cmd.TeamId, ct);

        if (team is null || team.TenantId != scope)
            return Result.Failure<TeamDto>(Error.NotFoundById("Team", cmd.TeamId));

        if (team.TeamLeadUserId == cmd.UserId)
            return Result.Failure<TeamDto>(Error.Custom("Team.Conflict",
                "This user leads the team — pick a different lead before removing them."));

        team.RemoveMember(cmd.UserId);
        await uow.SaveChangesAsync(ct);
        return Result.Success(await TeamMapping.ToDtoAsync(repo, team, ct));
    }
}

public sealed class DeleteTeamCommandHandler(ITeamRepository repo, IUnitOfWork uow, ICurrentUser currentUser, ITenantContext tenant)
    : ICommandHandler<DeleteTeamCommand>
{
    public async Task<Result> Handle(DeleteTeamCommand cmd, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);
        var team = await repo.GetByIdAsync(cmd.Id, ct);

        if (team is null || team.TenantId != scope)
            return Result.Failure(Error.NotFoundById("Team", cmd.Id));

        team.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public sealed class GetTeamLeadCandidatesQueryHandler(
    ITeamRepository repo, ICurrentUser currentUser, ITenantContext tenant)
    : IQueryHandler<GetTeamLeadCandidatesQuery, IReadOnlyList<TeamMemberDto>>
{
    public async Task<Result<IReadOnlyList<TeamMemberDto>>> Handle(GetTeamLeadCandidatesQuery query, CancellationToken ct)
    {
        var users = await repo.GetTeamLeadCandidatesAsync(TeamScope.For(currentUser, tenant), ct);
        return Result.Success<IReadOnlyList<TeamMemberDto>>(
            users.Select(u => new TeamMemberDto(u.Id, u.FullName, u.Email, true)).ToList());
    }
}

public sealed class GetAssignableUsersQueryHandler(
    ITeamRepository repo, ICurrentUser currentUser, ITenantContext tenant)
    : IQueryHandler<GetAssignableUsersQuery, IReadOnlyList<TeamMemberDto>>
{
    /// <summary>
    /// Drops anyone without access to the module the work belongs to. Applied to both branches:
    /// an admin routing a lead should no more be offered a warehouse clerk than a team lead should.
    /// </summary>
    private async Task<List<TeamUserInfo>> NarrowToModuleAsync(
        List<TeamUserInfo> users, string? module, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(module) || users.Count == 0) return users;

        var allowed = await repo.FilterUsersWithModuleAccessAsync(
            users.Select(u => u.Id).ToList(), module, ct);

        // Super admins hold no explicit permission rows, so they would filter themselves out.
        var keepSelf = currentUser.IsSuperAdmin ? currentUser.Id : null;

        return users.Where(u => allowed.Contains(u.Id) || u.Id == keepSelf).ToList();
    }

    public async Task<Result<IReadOnlyList<TeamMemberDto>>> Handle(GetAssignableUsersQuery query, CancellationToken ct)
    {
        var scope = TeamScope.For(currentUser, tenant);

        // Admins route work to anyone; the tenant-wide lead-edit key and user administration both
        // qualify, matching who can already reassign today.
        var isAdmin = currentUser.IsSuperAdmin
                   || currentUser.HasPermission("crm.leads.edit")
                   || currentUser.HasPermission("settings.users.edit");

        if (isAdmin)
        {
            // Everyone, with team leads flagged and listed first — an admin routing work usually
            // wants to hand it to a lead, who then distributes it within their team.
            var all = await repo.GetActiveTenantUsersAsync(scope, ct);
            all = await NarrowToModuleAsync(all, query.Module, ct);
            var allLeads = (await repo.GetAllTeamLeadIdsAsync(scope, ct)).ToHashSet();
            var allTeams = await repo.GetTeamsByUserAsync(all.Select(u => u.Id).ToList(), scope, ct);
            return Result.Success<IReadOnlyList<TeamMemberDto>>(
                all.Select(u => new TeamMemberDto(
                        u.Id, u.FullName, u.Email, allLeads.Contains(u.Id),
                        allTeams.TryGetValue(u.Id, out var names) ? names : []))
                   .OrderByDescending(u => u.IsLead)
                   .ThenBy(u => u.FullName)
                   .ToList());
        }

        if (currentUser.Id is not { } uid)
            return Result.Success<IReadOnlyList<TeamMemberDto>>([]);

        // Team lead → their own members (downward). A plain member → the lead(s) of the teams they
        // belong to (upward), so work can be handed back up the hierarchy instead of leaving them
        // with an empty picker. Both always include the user themselves.
        var ids = await repo.GetMemberIdsOfTeamsLedByAsync(uid, scope, ct);
        var leadIds = await repo.GetLeadIdsOfTeamsContainingAsync(uid, scope, ct);

        foreach (var id in leadIds)
            if (!ids.Contains(id)) ids.Add(id);

        if (ids.Count == 0)
            return Result.Success<IReadOnlyList<TeamMemberDto>>([]);

        if (!ids.Contains(uid)) ids.Add(uid);

        // IsLead marks the team's lead(s) so the picker can label them — not the caller.
        var leadSet = leadIds.ToHashSet();
        var users = await repo.GetUsersAsync(ids, ct);
        users = await NarrowToModuleAsync(users, query.Module, ct);
        var teamNames = await repo.GetTeamsByUserAsync(ids, scope, ct);
        return Result.Success<IReadOnlyList<TeamMemberDto>>(
            users.Select(u => new TeamMemberDto(
                     u.Id, u.FullName, u.Email, leadSet.Contains(u.Id),
                     teamNames.TryGetValue(u.Id, out var names) ? names : []))
                 .OrderByDescending(u => u.IsLead)
                 .ThenBy(u => u.FullName)
                 .ToList());
    }
}
