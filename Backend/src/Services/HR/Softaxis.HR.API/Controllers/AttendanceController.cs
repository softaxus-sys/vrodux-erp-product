using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Application.Attendance.Queries;

namespace Softaxis.HR.API.Controllers;

[ApiController]
[Route("api/hr/attendance")]
[Authorize]
public sealed class AttendanceController(ISender sender) : HrControllerBase
{
    public sealed record UpdateAttendanceRequest(
        string?  CheckIn,
        string?  CheckOut,
        decimal? WorkingHours,
        string   Status,
        string?  Notes);

    // ── GET /api/hr/attendance/summary ──────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetAttendanceSummaryQuery(), ct);
        return OkOrError(result);
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
        var result = await sender.Send(
            new GetAttendanceLogsQuery(page, pageSize, date, dateFrom, dateTo, status, employeeId), ct);
        return OkOrError(result);
    }

    // ── GET /api/hr/attendance/{id} ──────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetAttendanceLogByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/hr/attendance ──────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAttendanceLogCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    // ── PUT /api/hr/attendance/{id} ──────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAttendanceRequest req, CancellationToken ct)
    {
        var result = await sender.Send(
            new UpdateAttendanceLogCommand(id, req.CheckIn, req.CheckOut, req.WorkingHours, req.Status, req.Notes), ct);
        return NoContentOrError(result);
    }

    // ── DELETE /api/hr/attendance/{id} ───────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteAttendanceLogCommand(id), ct);
        return NoContentOrError(result);
    }
}
