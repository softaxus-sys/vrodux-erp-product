using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.API.Authorization;
using Softaxis.Identity.Application.Teams;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Teams — the middle rung of admin → team lead → team member.
///
/// Managed alongside Users and Roles, so it gates on the same <c>settings.users.*</c> surface that
/// role assignment already uses rather than introducing a separate permission group. Reads are open
/// to any authenticated user because the assignment pickers need them (a team lead must be able to
/// list their own members to hand a lead onward); the handlers still scope every read to the
/// caller's tenant.
/// </summary>
[Authorize]
[Tags("Teams")]
public sealed class TeamsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>All teams for the caller's tenant. Management view — the org roster is not
    /// exposed to restricted users, who use <c>assignable-users</c> instead.</summary>
    [HttpGet]
    [RequirePermission("settings.users.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetTeamsQuery(search), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("settings.users.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTeamByIdQuery(id), ct));

    /// <summary>Who may be picked as a team lead — only users whose permissions actually grant the
    /// team tier, so a team can never be handed to someone who would then see nothing.</summary>
    [HttpGet("lead-candidates")]
    [RequirePermission("settings.users.view")]
    public async Task<IActionResult> LeadCandidates(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetTeamLeadCandidatesQuery(), ct));

    [HttpPost]
    [RequirePermission("settings.users.edit")]
    public async Task<IActionResult> Create([FromBody] CreateTeamCommand command, CancellationToken ct)
        => HandleResult(await Sender.Send(command, ct), 201);

    [HttpPut("{id:guid}")]
    [RequirePermission("settings.users.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTeamRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateTeamCommand(id, request.Name, request.Description, request.TeamLeadUserId, request.IsActive), ct));

    [HttpPost("{id:guid}/members")]
    [RequirePermission("settings.users.edit")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] TeamMemberRequest request, CancellationToken ct)
        => HandleResult(await Sender.Send(new AddTeamMemberCommand(id, request.UserId), ct));

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [RequirePermission("settings.users.edit")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken ct)
        => HandleResult(await Sender.Send(new RemoveTeamMemberCommand(id, userId), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("settings.users.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteTeamCommand(id), ct));

    /// <summary>Who the caller may hand a lead to. Authenticated-only by design: it returns just
    /// the caller's own assignable pool, so it leaks nothing a restricted user should not see.</summary>
    [HttpGet("assignable-users")]
    public async Task<IActionResult> AssignableUsers(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetAssignableUsersQuery(), ct));

    public sealed record UpdateTeamRequest(string Name, string? Description, Guid? TeamLeadUserId, bool IsActive);
    public sealed record TeamMemberRequest(Guid UserId);
}
