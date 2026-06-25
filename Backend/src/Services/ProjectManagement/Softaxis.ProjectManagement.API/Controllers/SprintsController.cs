using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Authorization;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Application.Sprints.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage sprints used for backlog planning within a project.</summary>
[Route("api/projectmanagement/projects/{projectId:guid}/sprints")]
[Authorize]
public sealed class SprintsController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/projects/{projectId}/sprints</summary>
    [HttpGet]
    [RequirePermission("project-management.sprints.view")]
    public async Task<IActionResult> GetAll(Guid projectId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSprintsQuery(projectId), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/sprints</summary>
    [HttpPost]
    [RequirePermission("project-management.sprints.create")]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateSprintRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateSprintCommand(projectId, req.Name, req.Goal, req.StartDate, req.EndDate), ct);
        return CreatedOrError(result, nameof(GetAll), new { projectId });
    }

    /// <summary>PUT /api/projectmanagement/projects/{projectId}/sprints/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("project-management.sprints.edit")]
    public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateSprintRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateSprintCommand(id, req.Name, req.Goal, req.StartDate, req.EndDate), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/sprints/{id}/start</summary>
    [HttpPost("{id:guid}/start")]
    [RequirePermission("project-management.sprints.edit")]
    public async Task<IActionResult> Start(Guid projectId, Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartSprintCommand(id), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/sprints/{id}/complete</summary>
    [HttpPost("{id:guid}/complete")]
    [RequirePermission("project-management.sprints.edit")]
    public async Task<IActionResult> Complete(Guid projectId, Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new CompleteSprintCommand(id), ct));

    /// <summary>DELETE /api/projectmanagement/projects/{projectId}/sprints/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("project-management.sprints.delete")]
    public async Task<IActionResult> Delete(Guid projectId, Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteSprintCommand(id), ct));

    public sealed record CreateSprintRequest(string Name, string? Goal = null, string? StartDate = null, string? EndDate = null);
    public sealed record UpdateSprintRequest(string Name, string? Goal = null, string? StartDate = null, string? EndDate = null);
}
