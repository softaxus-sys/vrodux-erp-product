using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.Labels.Commands;
using Softaxis.ProjectManagement.Application.Labels.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage labels used to tag issues within a project.</summary>
[Route("api/projectmanagement/projects/{projectId:guid}/labels")]
[Authorize]
public sealed class LabelsController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/projects/{projectId}/labels</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid projectId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetLabelsQuery(projectId), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/labels</summary>
    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateLabelRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateLabelCommand(projectId, req.Name, req.Color ?? "#64748b"), ct);
        return CreatedOrError(result, nameof(GetAll), new { projectId });
    }

    /// <summary>PUT /api/projectmanagement/projects/{projectId}/labels/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateLabelRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateLabelCommand(id, req.Name, req.Color), ct));

    /// <summary>DELETE /api/projectmanagement/projects/{projectId}/labels/{id}</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid projectId, Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteLabelCommand(id), ct));

    public sealed record CreateLabelRequest(string Name, string? Color = null);
    public sealed record UpdateLabelRequest(string Name, string Color);
}
