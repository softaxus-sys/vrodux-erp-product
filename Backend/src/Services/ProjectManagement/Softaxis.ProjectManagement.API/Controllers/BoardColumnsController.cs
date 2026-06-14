using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.BoardColumns.Commands;
using Softaxis.ProjectManagement.Application.BoardColumns.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage the Kanban board columns of a project.</summary>
[Route("api/projectmanagement/projects/{projectId:guid}/columns")]
[Authorize]
public sealed class BoardColumnsController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/projects/{projectId}/columns</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid projectId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBoardColumnsQuery(projectId), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/columns</summary>
    [HttpPost]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateBoardColumnRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateBoardColumnCommand(projectId, req.Name, req.Category ?? "todo"), ct);
        return CreatedOrError(result, nameof(GetAll), new { projectId });
    }

    /// <summary>PUT /api/projectmanagement/projects/{projectId}/columns/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid projectId, Guid id, [FromBody] UpdateBoardColumnRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateBoardColumnCommand(id, req.Name), ct));

    /// <summary>DELETE /api/projectmanagement/projects/{projectId}/columns/{id}</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid projectId, Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteBoardColumnCommand(id), ct));

    /// <summary>POST /api/projectmanagement/projects/{projectId}/columns/reorder</summary>
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder(Guid projectId, [FromBody] ReorderBoardColumnsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReorderBoardColumnsCommand(projectId, req.Items), ct));

    public sealed record CreateBoardColumnRequest(string Name, string? Category = null);
    public sealed record UpdateBoardColumnRequest(string Name);
    public sealed record ReorderBoardColumnsRequest(IReadOnlyList<ReorderBoardColumnItem> Items);
}
