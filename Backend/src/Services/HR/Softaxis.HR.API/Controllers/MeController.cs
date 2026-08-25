using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.Self.Commands;
using Softaxis.HR.Application.Self.Queries;

namespace Softaxis.HR.API.Controllers;

/// <summary>
/// Employee self-service. Everything here is about the signed-in person and nobody else.
///
/// <para><b>No route on this controller accepts an employee id.</b> The subject is resolved from
/// the JWT, which is what makes these endpoints structurally incapable of returning a colleague's
/// salary, leave or attendance — the guarantee does not depend on remembering a filter.</para>
///
/// <para>Gated on the <c>hr.self.*</c> tier rather than the administrative keys. Granting
/// <c>hr.leaves.create</c> so somebody can book a day off would also let them file leave for
/// anyone and read everyone's requests; this tier exists so that trade never has to be made.</para>
/// </summary>
[ApiController]
[Route("api/hr/me")]
[Authorize]
public sealed class MeController(ISender sender) : HrControllerBase
{
    public sealed record ApplyLeaveRequest(
        string LeaveType, string StartDate, string EndDate, decimal TotalDays, string? Reason);

    // ── Profile ──────────────────────────────────────────────────────────
    [HttpGet("profile")]
    [RequirePermission("hr.self.view")]
    public async Task<IActionResult> Profile(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyProfileQuery(), ct));

    // ── Leave ────────────────────────────────────────────────────────────
    [HttpGet("leaves")]
    [RequirePermission("hr.self.leave-request")]
    public async Task<IActionResult> MyLeaves(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyLeavesQuery(), ct));

    [HttpGet("leave-balances")]
    [RequirePermission("hr.self.view")]
    public async Task<IActionResult> MyLeaveBalances([FromQuery] int? year, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyLeaveBalancesQuery(year), ct));

    [HttpPost("leaves")]
    [RequirePermission("hr.self.leave-request")]
    public async Task<IActionResult> ApplyForLeave([FromBody] ApplyLeaveRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApplyForLeaveCommand(
            req.LeaveType, req.StartDate, req.EndDate, req.TotalDays, req.Reason), ct));

    [HttpPost("leaves/{leaveId:guid}/cancel")]
    [RequirePermission("hr.self.leave-request")]
    public async Task<IActionResult> CancelMyLeave(Guid leaveId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new CancelMyLeaveCommand(leaveId), ct));

    // ── Attendance ───────────────────────────────────────────────────────
    [HttpGet("attendance")]
    [RequirePermission("hr.self.attendance")]
    public async Task<IActionResult> MyAttendance(
        [FromQuery] string? fromDate, [FromQuery] string? toDate, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyAttendanceQuery(fromDate, toDate), ct));

    [HttpGet("attendance/today")]
    [RequirePermission("hr.self.attendance")]
    public async Task<IActionResult> Today(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyAttendanceTodayQuery(), ct));

    [HttpPost("attendance/check-in")]
    [RequirePermission("hr.self.attendance")]
    public async Task<IActionResult> CheckIn(CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckInCommand(), ct));

    [HttpPost("attendance/check-out")]
    [RequirePermission("hr.self.attendance")]
    public async Task<IActionResult> CheckOut(CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckOutCommand(), ct));

    // ── Payslips ─────────────────────────────────────────────────────────
    [HttpGet("payslips")]
    [RequirePermission("hr.self.payslip")]
    public async Task<IActionResult> MyPayslips(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMyPayslipsQuery(), ct));
}
