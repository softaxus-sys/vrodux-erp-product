using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/payroll")]
[Authorize]
public sealed class PayrollController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record PayrollSlipDto(
        Guid    Id,
        Guid    EmployeeId,
        string  EmployeeName,
        string? JobTitle,
        string? DepartmentName,
        decimal BasicSalary,
        decimal Allowances,
        decimal Deductions,
        decimal NetSalary,
        string? Notes);

    public record PayrollRunDto(
        Guid      Id,
        string    RunNumber,
        string    Period,
        decimal   TotalBasicSalary,
        decimal   TotalAllowances,
        decimal   TotalDeductions,
        decimal   TotalNetSalary,
        string    Status,
        string?   Notes,
        int       SlipCount,
        DateTime? ProcessedAt,
        DateTime? PaidAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record PayrollRunDetailDto(
        Guid      Id,
        string    RunNumber,
        string    Period,
        decimal   TotalBasicSalary,
        decimal   TotalAllowances,
        decimal   TotalDeductions,
        decimal   TotalNetSalary,
        string    Status,
        string?   Notes,
        IReadOnlyList<PayrollSlipDto> Slips,
        DateTime? ProcessedAt,
        DateTime? PaidAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record SlipRequest(
        Guid    EmployeeId,
        string  EmployeeName,
        string? JobTitle,
        string? DepartmentName,
        decimal BasicSalary,
        decimal Allowances,
        decimal Deductions,
        string? Notes);

    public record CreatePayrollRunRequest(
        string  Period,
        string? Notes,
        IReadOnlyList<SlipRequest> Slips);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    // ── GET /api/hr/payroll/summary ──────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var thisPeriod = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.PayrollRuns
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var draft     = statusCounts.FirstOrDefault(c => c.Status == "draft")?.Count     ?? 0;
        var processed = statusCounts.FirstOrDefault(c => c.Status == "processed")?.Count ?? 0;
        var paid      = statusCounts.FirstOrDefault(c => c.Status == "paid")?.Count      ?? 0;

        var thisMonthRun = await db.PayrollRuns
            .AsNoTracking()
            .Where(x => x.Period == thisPeriod)
            .Select(x => new
            {
                x.Status,
                x.TotalNetSalary,
                EmployeeCount = x.Slips.Count
            })
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            AllTime = new
            {
                Draft     = draft,
                Processed = processed,
                Paid      = paid,
                Total     = draft + processed + paid
            },
            ThisMonth = thisMonthRun is null
                ? null
                : new
                {
                    thisMonthRun.Status,
                    thisMonthRun.TotalNetSalary,
                    thisMonthRun.EmployeeCount
                }
        });
    }

    // ── GET /api/hr/payroll ──────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? period   = null,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        IQueryable<PayrollRun> query = db.PayrollRuns.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(period))
            query = query.Where(x => x.Period == period);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.Period)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PayrollRunDto(
                x.Id, x.RunNumber, x.Period,
                x.TotalBasicSalary, x.TotalAllowances, x.TotalDeductions, x.TotalNetSalary,
                x.Status, x.Notes,
                x.Slips.Count,
                x.ProcessedAt, x.PaidAt, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<PayrollRunDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/payroll/{id} ─────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .AsNoTracking()
            .Include(x => x.Slips)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (run is null) return NotFound();
        return Ok(ToDetailDto(run));
    }

    // ── POST /api/hr/payroll ─────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePayrollRunRequest req, CancellationToken ct)
    {
        // Prevent duplicate payroll run for same period
        var periodExists = await db.PayrollRuns
            .AnyAsync(x => x.Period == req.Period && x.Status != "draft", ct);
        if (periodExists)
            return Conflict(new { error = $"A processed payroll run already exists for period {req.Period}." });

        var run = new PayrollRun(req.Period, req.Notes);

        foreach (var s in req.Slips)
            run.Slips.Add(new PayrollSlip(
                run.Id, s.EmployeeId, s.EmployeeName,
                s.JobTitle, s.DepartmentName,
                s.BasicSalary, s.Allowances, s.Deductions, s.Notes));

        run.Recalculate();
        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = run.Id }, ToDetailDto(run));
    }

    // ── POST /api/hr/payroll/generate ────────────────────────────────────
    // Auto-generate slips from all active employees for the given period
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest req, CancellationToken ct)
    {
        var periodExists = await db.PayrollRuns
            .AnyAsync(x => x.Period == req.Period && x.Status != "draft", ct);
        if (periodExists)
            return Conflict(new { error = $"A processed payroll run already exists for period {req.Period}." });

        var employees = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active")
            .ToListAsync(ct);

        if (employees.Count == 0)
            return BadRequest(new { error = "No active employees found." });

        var run = new PayrollRun(req.Period, req.Notes);

        foreach (var emp in employees)
            run.Slips.Add(new PayrollSlip(
                run.Id, emp.Id, emp.FullName,
                emp.JobTitle, emp.DepartmentName,
                emp.BasicSalary, 0m, 0m, null));

        run.Recalculate();
        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = run.Id }, ToDetailDto(run));
    }

    public record GenerateRequest(string Period, string? Notes);

    // ── POST /api/hr/payroll/{id}/process ────────────────────────────────
    [HttpPost("{id:guid}/process")]
    public async Task<IActionResult> Process(Guid id, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .Include(x => x.Slips)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (run is null) return NotFound();
        if (run.Status != "draft")
            return BadRequest(new { error = "Only draft payroll runs can be processed." });

        run.Recalculate();
        run.MarkProcessed();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/hr/payroll/{id}/pay ────────────────────────────────────
    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> Pay(Guid id, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([id], ct);
        if (run is null) return NotFound();
        if (run.Status != "processed")
            return BadRequest(new { error = "Only processed payroll runs can be marked as paid." });

        run.MarkPaid();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/payroll/{id} ──────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([id], ct);
        if (run is null) return NotFound();
        if (run.Status != "draft")
            return BadRequest(new { error = "Only draft payroll runs can be deleted." });

        run.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helper ────────────────────────────────────────────────────────────
    private static PayrollRunDetailDto ToDetailDto(PayrollRun r) => new(
        r.Id, r.RunNumber, r.Period,
        r.TotalBasicSalary, r.TotalAllowances, r.TotalDeductions, r.TotalNetSalary,
        r.Status, r.Notes,
        r.Slips.Select(s => new PayrollSlipDto(
            s.Id, s.EmployeeId, s.EmployeeName, s.JobTitle, s.DepartmentName,
            s.BasicSalary, s.Allowances, s.Deductions, s.NetSalary, s.Notes)).ToList(),
        r.ProcessedAt, r.PaidAt, r.CreatedAt, r.UpdatedAt);
}
