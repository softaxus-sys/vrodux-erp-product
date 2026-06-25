using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.ProjectManagement.API.Authorization;
using Softaxis.ProjectManagement.API.Controllers.Common;
using Softaxis.ProjectManagement.Application.Comments.Commands;
using Softaxis.ProjectManagement.Application.Comments.Queries;

namespace Softaxis.ProjectManagement.API.Controllers;

/// <summary>Manage comments on an issue.</summary>
[Route("api/projectmanagement/issues/{issueId:guid}/comments")]
[Authorize]
public sealed class CommentsController(ISender sender) : ProjectManagementControllerBase
{
    /// <summary>GET /api/projectmanagement/issues/{issueId}/comments</summary>
    [HttpGet]
    [RequirePermission("project-management.issues.view")]
    public async Task<IActionResult> GetAll(Guid issueId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCommentsQuery(issueId), ct));

    /// <summary>POST /api/projectmanagement/issues/{issueId}/comments</summary>
    [HttpPost]
    [RequirePermission("project-management.issues.create")]
    public async Task<IActionResult> Create(Guid issueId, [FromBody] CreateCommentRequest req, CancellationToken ct)
    {
        var authorName = User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? "Unknown";

        var result = await sender.Send(new CreateCommentCommand(issueId, authorName, req.Body), ct);
        return CreatedOrError(result, nameof(GetAll), new { issueId });
    }

    /// <summary>PUT /api/projectmanagement/issues/{issueId}/comments/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("project-management.issues.edit")]
    public async Task<IActionResult> Update(Guid issueId, Guid id, [FromBody] UpdateCommentRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateCommentCommand(id, req.Body), ct));

    /// <summary>DELETE /api/projectmanagement/issues/{issueId}/comments/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("project-management.issues.delete")]
    public async Task<IActionResult> Delete(Guid issueId, Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteCommentCommand(id), ct));

    public sealed record CreateCommentRequest(string Body);
    public sealed record UpdateCommentRequest(string Body);
}
