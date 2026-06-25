using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Authorization;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.Projects.Commands;
using Softaxis.ProjectManagement.Application.Projects.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage projects — the top-level container for boards, sprints, and issues.</summary>
[Route("api/projectmanagement/projects")]
[Authorize]
public sealed class ProjectsController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/projects</summary>
    [HttpGet]
    [RequirePermission("project-management.projects.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProjectsQuery(), ct));

    /// <summary>GET /api/projectmanagement/projects/{id}</summary>
    [HttpGet("{id:guid}")]
    [RequirePermission("project-management.projects.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProjectByIdQuery(id), ct));

    /// <summary>POST /api/projectmanagement/projects</summary>
    [HttpPost]
    [RequirePermission("project-management.projects.create")]
    public async Task<IActionResult> Create([FromBody] CreateProjectCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? result.Value.Id : Guid.Empty });
    }

    /// <summary>PUT /api/projectmanagement/projects/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateProjectCommand(id, req.Name, req.Description, req.LeadName), ct));

    /// <summary>POST /api/projectmanagement/projects/{id}/archive</summary>
    [HttpPost("{id:guid}/archive")]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ArchiveProjectCommand(id), ct));

    /// <summary>POST /api/projectmanagement/projects/{id}/activate</summary>
    [HttpPost("{id:guid}/activate")]
    [RequirePermission("project-management.projects.edit")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ActivateProjectCommand(id), ct));

    /// <summary>DELETE /api/projectmanagement/projects/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("project-management.projects.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteProjectCommand(id), ct));

    public sealed record UpdateProjectRequest(string Name, string? Description = null, string? LeadName = null);
}
