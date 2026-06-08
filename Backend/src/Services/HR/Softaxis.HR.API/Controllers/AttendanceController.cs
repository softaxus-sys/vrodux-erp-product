using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/attendance")]
[Authorize]
public sealed class AttendanceController(HrDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record AttendanceLogDto(
        Guid      Id,
        Guid      EmployeeId,
        string    EmployeeName,
        string    Date,
        string?   CheckIn,
        string?   CheckOut,
        decimal?  WorkingHours,
        string    Status,
        string?   Notes,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record CreateAttendanceRequest(
        Guid     EmployeeId,
        string   EmployeeName,
        string   Date,
        string?  CheckIn,
        string?  CheckOut,
        decimal? WorkingHours,
        string   Status,
        string?  Notes);

    public record UpdateAttendanceRequest(
        string?  CheckIn,
        string?  CheckOut,
        decimal? WorkingHours,
        string   Status,
        string?  Notes);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    // ── GET /api/hr/attendance/summary ──────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var today            = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var thisMonthPrefix  = DateTime.UtcNow.ToString("yyyy-MM");

        // Today breakdown
        var todayCounts = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Date == today)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var todayPresent = todayCounts.FirstOrDefault(c => c.Status == "present")?.Count  ?? 0;
        var todayAbsent  = todayCounts.FirstOrDefault(c => c.Status == "absent")?.Count   ?? 0;
        var todayLate    = todayCounts.FirstOrDefault(c => c.Status == "late")?.Count     ?? 0;
        var todayTotal   = todayCounts.Sum(c => c.Count);

        // This month
        var monthLogs = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Date.StartsWith(thisMonthPrefix))
            .Select(x => new { x.Status, x.WorkingHours })
            .ToListAsync(ct);

        var monthPresent    = monthLogs.Count(x => x.Status == "present");
        var avgWorkingHours = monthLogs
            .Where(x => x.WorkingHours.HasValue)
            .Select(x => (double)x.WorkingHours!.Value)
            .DefaultIfEmpty(0)
            .Average();

        return Ok(new
        {
            Today = new
            {
                Date    = today,
                Total   = todayTotal,
                Present = todayPresent,
                Absent  = todayAbsent,
                Late    = todayLate
            },
            ThisMonth = new
            {
                PresentCount    = monthPresent,
                TotalRecords    = monthLogs.Count,
                AvgWorkingHours = Math.Round(avgWorkingHours, 2)
            },
            // Flat keys consumed by the dashboard
            PresentToday = todayPresent,
            LateToday    = todayLate,
            AbsentToday  = todayAbsent,
            TotalEmployees = todayTotal,
        });
    }

    // ── GET /api/hr/attendance ───────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 30,
        [FromQuery] string? date       = null,
        [FromQuery] string? dateFrom   = null,
        [FromQuery] string? dateTo     = null,
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   employeeId = null,
        CancellationToken ct = default)
    {
        IQueryable<AttendanceLog> query = db.AttendanceLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(date))
            query = query.Where(x => x.Date == date);

        if (!string.IsNullOrWhiteSpace(dateFrom))
            query = query.Where(x => string.Compare(x.Date, dateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(dateTo))
            query = query.Where(x => string.Compare(x.Date, dateTo) <= 0);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (employeeId.HasValue)
            query = query.Where(x => x.EmployeeId == employeeId.Value);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.Date).ThenBy(x => x.EmployeeName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AttendanceLogDto(
                x.Id, x.EmployeeId, x.EmployeeName, x.Date,
                x.CheckIn, x.CheckOut, x.WorkingHours,
                x.Status, x.Notes, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<AttendanceLogDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/hr/attendance/{id} ──────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var log = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AttendanceLogDto(
                x.Id, x.EmployeeId, x.EmployeeName, x.Date,
                x.CheckIn, x.CheckOut, x.WorkingHours,
                x.Status, x.Notes, x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return log is null ? NotFound() : Ok(log);
    }

    // ── POST /api/hr/attendance ──────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAttendanceRequest req, CancellationToken ct)
    {
        // Check for duplicate (employee + date unique constraint)
        var exists = await db.AttendanceLogs
            .AnyAsync(x => x.EmployeeId == req.EmployeeId && x.Date == req.Date, ct);
        if (exists)
            return Conflict(new { error = $"Attendance record already exists for this employee on {req.Date}." });

        var log = new AttendanceLog(
            req.EmployeeId, req.EmployeeName, req.Date,
            req.CheckIn, req.CheckOut, req.WorkingHours,
            req.Status, req.Notes);

        db.AttendanceLogs.Add(log);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = log.Id },
            new AttendanceLogDto(log.Id, log.EmployeeId, log.EmployeeName, log.Date,
                log.CheckIn, log.CheckOut, log.WorkingHours,
                log.Status, log.Notes, log.CreatedAt, log.UpdatedAt));
    }

    // ── PUT /api/hr/attendance/{id} ──────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAttendanceRequest req, CancellationToken ct)
    {
        var log = await db.AttendanceLogs.FindAsync([id], ct);
        if (log is null) return NotFound();

        log.Update(req.CheckIn, req.CheckOut, req.WorkingHours, req.Status, req.Notes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/hr/attendance/{id} ───────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var log = await db.AttendanceLogs.FindAsync([id], ct);
        if (log is null) return NotFound();
        db.AttendanceLogs.Remove(log);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
