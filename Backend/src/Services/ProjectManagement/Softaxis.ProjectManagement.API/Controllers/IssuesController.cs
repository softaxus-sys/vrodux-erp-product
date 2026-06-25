using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Authorization;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage issues (epics, stories, tasks, bugs) within projects.</summary>
[Route("api/projectmanagement/issues")]
[Authorize]
public sealed class IssuesController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/issues?projectId=&amp;sprintId=&amp;boardColumnId=&amp;type=&amp;assigneeName=&amp;search=</summary>
    [HttpGet]
    [RequirePermission("project-management.issues.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid projectId, [FromQuery] Guid? sprintId, [FromQuery] Guid? boardColumnId,
        [FromQuery] string? type, [FromQuery] string? assigneeName, [FromQuery] string? search,
        CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIssuesQuery(projectId, sprintId, boardColumnId, type, assigneeName, search), ct));

    /// <summary>GET /api/projectmanagement/issues/{id}</summary>
    [HttpGet("{id:guid}")]
    [RequirePermission("project-management.issues.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIssueByIdQuery(id), ct));

    /// <summary>POST /api/projectmanagement/issues</summary>
    [HttpPost]
    [RequirePermission("project-management.issues.create")]
    public async Task<IActionResult> Create([FromBody] CreateIssueRequest req, CancellationToken ct)
    {
        var reporterName = User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? "Unknown";

        var result = await sender.Send(new CreateIssueCommand(
            req.ProjectId, req.Title, reporterName, req.Description, req.Type ?? "task", req.Priority ?? "medium",
            req.BoardColumnId, req.AssigneeId, req.AssigneeName, req.EpicId, req.SprintId,
            req.StoryPoints, req.DueDate, req.LabelIds), ct);

        return CreatedOrError(result, nameof(GetById), result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    /// <summary>PUT /api/projectmanagement/issues/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("project-management.issues.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIssueRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateIssueCommand(
            id, req.Title, req.Description, req.Type, req.Priority,
            req.AssigneeId, req.AssigneeName, req.EpicId, req.StoryPoints, req.DueDate, req.LabelIds), ct));

    /// <summary>POST /api/projectmanagement/issues/{id}/move</summary>
    [HttpPost("{id:guid}/move")]
    [RequirePermission("project-management.issues.edit")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveIssueRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new MoveIssueCommand(id, req.BoardColumnId, req.SortOrder), ct));

    /// <summary>POST /api/projectmanagement/issues/{id}/move-to-sprint</summary>
    [HttpPost("{id:guid}/move-to-sprint")]
    [RequirePermission("project-management.issues.edit")]
    public async Task<IActionResult> MoveToSprint(Guid id, [FromBody] MoveIssueToSprintRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new MoveIssueToSprintCommand(id, req.SprintId, req.SortOrder), ct));

    /// <summary>DELETE /api/projectmanagement/issues/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("project-management.issues.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteIssueCommand(id), ct));

    public sealed record CreateIssueRequest(
        Guid ProjectId, string Title, string? Description = null, string? Type = null, string? Priority = null,
        Guid? BoardColumnId = null, Guid? AssigneeId = null, string? AssigneeName = null,
        Guid? EpicId = null, Guid? SprintId = null, decimal? StoryPoints = null, string? DueDate = null,
        IReadOnlyList<Guid>? LabelIds = null);

    public sealed record UpdateIssueRequest(
        string Title, string? Description, string Type, string Priority,
        Guid? AssigneeId, string? AssigneeName, Guid? EpicId,
        decimal? StoryPoints, string? DueDate, IReadOnlyList<Guid>? LabelIds = null);

    public sealed record MoveIssueRequest(Guid BoardColumnId, int SortOrder);

    public sealed record MoveIssueToSprintRequest(Guid? SprintId, int SortOrder);
}
