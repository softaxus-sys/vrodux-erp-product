using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/leaves")]
[Authorize]
public sealed class LeavesController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record LeaveDto(
        Guid      Id,
        string    LeaveNumber,
        Guid      EmployeeId,
        string    EmployeeName,
        string    LeaveType,
        string    StartDate,
        string    EndDate,
        decimal   TotalDays,
        string?   Reason,
        string    Status,
        Guid?     ApprovedById,
        string?   ApproverNotes,
        DateTime? ApprovedAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record CreateLeaveRequest(
        Guid    EmployeeId,
        string  EmployeeName,
        string  LeaveType,
        string  StartDate,
        string  EndDate,
        decimal TotalDays,
        string? Reason);

    public record ApproveRejectRequest(
        Guid    ApproverId,
        string? Notes);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    // ── GET /api/hr/leaves/summary ───────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var thisMonthPrefix = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.Leaves
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var pending  = statusCounts.FirstOrDefault(c => c.Status == "pending")?.Count  ?? 0;
        var approved = statusCounts.FirstOrDefault(c => c.Status == "approved")?.Count ?? 0;
        var rejected = statusCounts.FirstOrDefault(c => c.Status == "rejected")?.Count ?? 0;

        var thisMonthByType = await db.Leaves
            .AsNoTracking()
            .Where(x => x.StartDate.StartsWith(thisMonthPrefix))
            .GroupBy(x => x.LeaveType)
            .Select(g => new { LeaveType = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .ToListAsync(ct);

        return Ok(new
        {
            PendingApprovals = pending,
            Approved         = approved,
            Rejected         = rejected,
            ThisMonthByType  = thisMonthByType
        });
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
        IQueryable<Leave> query = db.Leaves.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.LeaveNumber.Contains(search) ||
                x.EmployeeName.Contains(search));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(leaveType))
            query = query.Where(x => x.LeaveType == leaveType);

        if (employeeId.HasValue)
            query = query.Where(x => x.EmployeeId == employeeId.Value);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToDto(x))
            .ToListAsync(ct);

        return Ok(new PagedResult<LeaveDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/leaves/{id} ──────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var leave = await db.Leaves
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => ToDto(x))
            .FirstOrDefaultAsync(ct);

        return leave is null ? NotFound() : Ok(leave);
    }

    // ── POST /api/hr/leaves ──────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeaveRequest req, CancellationToken ct)
    {
        var leave = new Leave(
            req.EmployeeId, req.EmployeeName, req.LeaveType,
            req.StartDate, req.EndDate, req.TotalDays, req.Reason);

        db.Leaves.Add(leave);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = leave.Id }, ToDto(leave));
    }

    // ── POST /api/hr/leaves/{id}/approve ────────────────────────────────
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([id], ct);
        if (leave is null) return NotFound();
        if (leave.Status != "pending")
            return BadRequest(new { error = "Only pending leaves can be approved." });

        leave.Approve(req.ApproverId, req.Notes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/leaves/{id}/reject ─────────────────────────────────
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRejectRequest req, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([id], ct);
        if (leave is null) return NotFound();
        if (leave.Status != "pending")
            return BadRequest(new { error = "Only pending leaves can be rejected." });

        leave.Reject(req.ApproverId, req.Notes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/leaves/{id}/cancel ─────────────────────────────────
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([id], ct);
        if (leave is null) return NotFound();
        if (leave.Status == "cancelled")
            return BadRequest(new { error = "Leave is already cancelled." });

        leave.Cancel();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/leaves/{id} ───────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([id], ct);
        if (leave is null) return NotFound();
        leave.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helper ────────────────────────────────────────────────────────────
    private static LeaveDto ToDto(Leave x) => new(
        x.Id, x.LeaveNumber, x.EmployeeId, x.EmployeeName, x.LeaveType,
        x.StartDate, x.EndDate, x.TotalDays, x.Reason, x.Status,
        x.ApprovedById, x.ApproverNotes, x.ApprovedAt, x.CreatedAt, x.UpdatedAt);
}
