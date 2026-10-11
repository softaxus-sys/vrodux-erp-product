using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Circulation;

namespace Softaxis.Library.API.Controllers;

/// <summary>
/// The desk: issue, return, renew, reserve, and the fines that follow. Issuing and reserving are
/// <c>create</c>; returning, renewing and reporting a loss are <c>edit</c>. Fines are their own
/// group because taking money and writing it off are separate decisions from lending a book.
/// </summary>
[Route("api/library")][Authorize]
public sealed class CirculationController(ISender sender) : LibraryControllerBase
{
    private const string View = "library.circulation.view";

    // ── Loans ───────────────────────────────────────────────────────────────

    // A member's own loans are shown on their record, so the members screen can read them too.
    [HttpGet("loans")]
    [RequirePermission(View, "library.members.view")]
    public async Task<IActionResult> GetLoans(
        [FromQuery] string? status, [FromQuery] Guid? branchId, [FromQuery] Guid? memberId, [FromQuery] Guid? titleId,
        [FromQuery] string? search, [FromQuery] string? today,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetLoansQuery(status, branchId, memberId, titleId, search, page, pageSize, today), ct));

    [HttpPost("loans")]
    [RequirePermission("library.circulation.create")]
    public async Task<IActionResult> Issue([FromBody] IssueRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new IssueLoanCommand(
            req.MemberId, req.CopyId, req.DueDate, req.Today,
            User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email)), ct));

    [HttpPost("loans/{id:guid}/return")]
    [RequirePermission("library.circulation.edit")]
    public async Task<IActionResult> Return(Guid id, [FromBody] ReturnRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReturnLoanCommand(id, req.ReturnBranchId, req.Damaged, req.Notes, req.Today), ct));

    [HttpPost("loans/{id:guid}/renew")]
    [RequirePermission("library.circulation.edit")]
    public async Task<IActionResult> Renew(Guid id, [FromBody] TodayRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RenewLoanCommand(id, req?.Today), ct));

    [HttpPost("loans/{id:guid}/lost")]
    [RequirePermission("library.circulation.edit")]
    public async Task<IActionResult> MarkLost(Guid id, [FromBody] TodayRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkLoanLostCommand(id, req?.Today), ct));

    // ── Reservations ────────────────────────────────────────────────────────

    [HttpGet("reservations")]
    [RequirePermission(View, "library.members.view")]
    public async Task<IActionResult> GetReservations(
        [FromQuery] string? status, [FromQuery] Guid? branchId, [FromQuery] Guid? memberId, [FromQuery] Guid? titleId,
        [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReservationsQuery(status, branchId, memberId, titleId, today), ct));

    [HttpPost("reservations")]
    [RequirePermission("library.circulation.create")]
    public async Task<IActionResult> Reserve([FromBody] ReserveRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateReservationCommand(req.TitleId, req.MemberId, req.PickupBranchId, req.Today), ct));

    [HttpPost("reservations/{id:guid}/cancel")]
    [RequirePermission("library.circulation.edit")]
    public async Task<IActionResult> CancelReservation(Guid id, [FromBody] TodayRequest? req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new CancelReservationCommand(id, req?.Today), ct));

    // ── Fines ───────────────────────────────────────────────────────────────

    [HttpGet("fines")]
    [RequirePermission("library.fines.view", "library.members.view")]
    public async Task<IActionResult> GetFines(
        [FromQuery] string? status, [FromQuery] Guid? memberId, [FromQuery] string? search, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFinesQuery(status, memberId, search), ct));

    [HttpGet("fines/summary")]
    [RequirePermission("library.fines.view")]
    public async Task<IActionResult> GetFinesSummary([FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFinesSummaryQuery(today), ct));

    [HttpPost("fines")]
    [RequirePermission("library.fines.create")]
    public async Task<IActionResult> CreateFine([FromBody] FineRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateFineCommand(req.MemberId, req.Type, req.Amount, req.Reason, req.Today), ct));

    [HttpPost("fines/{id:guid}/pay")]
    [RequirePermission("library.fines.edit")]
    public async Task<IActionResult> PayFine(Guid id, [FromBody] PayRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new PayFineCommand(id, req.Amount, req.Method, req.Today), ct));

    // Writing a fine off is a manager's call, not the desk's.
    [HttpPost("fines/{id:guid}/waive")]
    [RequirePermission("library.fines.approve")]
    public async Task<IActionResult> WaiveFine(Guid id, [FromBody] WaiveRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new WaiveFineCommand(id, req.Reason, req.Today), ct));

    public sealed record IssueRequest(Guid MemberId, Guid CopyId, string? DueDate, string? Today);
    public sealed record ReturnRequest(Guid? ReturnBranchId, bool Damaged = false, string? Notes = null, string? Today = null);
    public sealed record TodayRequest(string? Today);
    public sealed record ReserveRequest(Guid TitleId, Guid MemberId, Guid PickupBranchId, string? Today);
    public sealed record FineRequest(Guid MemberId, string Type, decimal Amount, string? Reason, string? Today);
    public sealed record PayRequest(decimal Amount, string? Method, string? Today);
    public sealed record WaiveRequest(string? Reason, string? Today);
}
