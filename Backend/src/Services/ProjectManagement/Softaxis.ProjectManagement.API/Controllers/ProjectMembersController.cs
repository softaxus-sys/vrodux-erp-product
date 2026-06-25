using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Authorization;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.ProjectMembers.Commands;
using Softaxis.ProjectManagement.Application.ProjectMembers.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage a project's team — who can see and access the project.</summary>
[Route("api/projectmanagement/projects/{projectId:guid}/members")]
[Authorize]
public sealed class ProjectMembersController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/projects/{projectId}/members</summary>
    [HttpGet]
    [RequirePermission("project-management.projects.view")]
    public async Task<IActionResult> GetAll(Guid projectId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProjectMembersQuery(projectId), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/members</summary>
    [HttpPost]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> Add(Guid projectId, [FromBody] AddMemberRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddProjectMemberCommand(projectId, req.UserId, req.UserName, req.UserEmail, req.Role), ct));

    /// <summary>PUT /api/projectmanagement/projects/{projectId}/members/{memberId}</summary>
    [HttpPut("{memberId:guid}")]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> UpdateRole(Guid projectId, Guid memberId, [FromBody] UpdateRoleRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateProjectMemberRoleCommand(projectId, memberId, req.Role), ct));

    /// <summary>DELETE /api/projectmanagement/projects/{projectId}/members/{memberId}</summary>
    [HttpDelete("{memberId:guid}")]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> Remove(Guid projectId, Guid memberId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new RemoveProjectMemberCommand(projectId, memberId), ct));

    public sealed record AddMemberRequest(Guid UserId, string UserName, string? UserEmail, string Role);
    public sealed record UpdateRoleRequest(string Role);
}
