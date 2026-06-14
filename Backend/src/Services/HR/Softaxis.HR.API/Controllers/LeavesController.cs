using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Application.Leaves.Queries;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/leaves")]
[Authorize]
public sealed class LeavesController(ISender sender) : HrControllerBase
{
    public sealed record ApproveRejectRequest(Guid ApproverId, string? Notes);

    // ── GET /api/hr/leaves/summary ───────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeavesSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/leaves ───────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? search     = null,
        [FromQuery] string? status     = null,
        [FromQuery] string? leaveType  = null,
        [FromQuery] Guid?   employeeId = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(
            new GetLeavesQuery(page, pageSize, search, status, leaveType, employeeId), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/leaves/{id} ──────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeaveByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/leaves ──────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeaveCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    // ── POST /api/hr/leaves/{id}/approve ────────────────────────────────
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ApproveLeaveCommand(id, req.ApproverId, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/leaves/{id}/reject ─────────────────────────────────
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new RejectLeaveCommand(id, req.ApproverId, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/leaves/{id}/cancel ─────────────────────────────────
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CancelLeaveCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/leaves/{id} ───────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteLeaveCommand(id), ct);
        return NoContentOrError(result);
    }
}
