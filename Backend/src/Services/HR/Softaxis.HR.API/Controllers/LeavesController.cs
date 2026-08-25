using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Application.Leaves.Queries;
using Softaxis.HR.Application.LeavePolicies.Commands;
using Softaxis.HR.Application.LeavePolicies.Queries;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/leaves")]
[Authorize]
public sealed class LeavesController(ISender sender) : HrControllerBase
{
    public sealed record ApproveRejectRequest(Guid ApproverId, string? Notes);

    public sealed record UpdatePolicyRequest(
        decimal AnnualEntitlementDays,
        bool    IsPaid,
        string? Description,
        bool    IsActive);

    // ── GET /api/hr/leaves/summary ───────────────────────────────────────
    [HttpGet("summary")]
    [RequirePermission("hr.leaves.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeavesSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/leaves ───────────────────────────────────────────────
    [HttpGet]
    [RequirePermission("hr.leaves.view")]
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

    // ── GET /api/hr/leaves/policies ──────────────────────────────────────
    // Entitlements are tenant configuration; a tenant seeds its defaults on first read.
    [HttpGet("policies")]
    [RequirePermission("hr.leaves.view")]
    public async Task<IActionResult> GetPolicies(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeavePoliciesQuery(), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/leaves/policies ─────────────────────────────────────
    [HttpPost("policies")]
    [RequirePermission("hr.leaves.edit")]
    public async Task<IActionResult> CreatePolicy([FromBody] CreateLeavePolicyCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return OkOrError(result);
    }

    // ── PUT /api/hr/leaves/policies/{id} ─────────────────────────────────
    [HttpPut("policies/{id:guid}")]
    [RequirePermission("hr.leaves.edit")]
    public async Task<IActionResult> UpdatePolicy(Guid id, [FromBody] UpdatePolicyRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeavePolicyCommand(
            id, req.AnnualEntitlementDays, req.IsPaid, req.Description, req.IsActive), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/leaves/policies/{id} ──────────────────────────────
    // Leave has no delete permission key, so this gates on edit (nearest seeded key).
    [HttpDelete("policies/{id:guid}")]
    [RequirePermission("hr.leaves.edit")]
    public async Task<IActionResult> DeletePolicy(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteLeavePolicyCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── GET /api/hr/leaves/balances ──────────────────────────────────────
    [HttpGet("balances")]
    [RequirePermission("hr.leaves.view")]
    public async Task<IActionResult> GetAllBalances([FromQuery] int? year, CancellationToken ct)
    {
        var result = await sender.Send(new GetAllLeaveBalancesQuery(year), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/leaves/balances/{employeeId} ─────────────────────────
    [HttpGet("balances/{employeeId:guid}")]
    [RequirePermission("hr.leaves.view")]
    public async Task<IActionResult> GetBalances(Guid employeeId, [FromQuery] int? year, CancellationToken ct)
    {
        var result = await sender.Send(new GetEmployeeLeaveBalancesQuery(employeeId, year), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/leaves/{id} ──────────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("hr.leaves.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeaveByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/leaves ──────────────────────────────────────────────
    [HttpPost]
    [RequirePermission("hr.leaves.create")]
    public async Task<IActionResult> Create([FromBody] CreateLeaveCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    // ── POST /api/hr/leaves/{id}/approve ────────────────────────────────
    [HttpPost("{id:guid}/approve")]
    [RequirePermission("hr.leaves.approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ApproveLeaveCommand(id, req.ApproverId, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/leaves/{id}/reject ─────────────────────────────────
    [HttpPost("{id:guid}/reject")]
    [RequirePermission("hr.leaves.approve")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new RejectLeaveCommand(id, req.ApproverId, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── POST /api/hr/leaves/{id}/cancel ─────────────────────────────────
    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("hr.leaves.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CancelLeaveCommand(id), ct);
        return NoContentOrError(result);
    }

    // NOTE: leaves has no seeded "delete" action — gate on "edit" (closest key) so admins keep working.
    // ── DELETE /api/hr/leaves/{id} ───────────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("hr.leaves.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteLeaveCommand(id), ct);
        return NoContentOrError(result);
    }
}
