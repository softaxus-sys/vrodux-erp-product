using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Reports;

namespace Softaxis.Library.API.Controllers;

/// <summary>
/// Library reports for the central Reports hub, and the hand-over of collected fines to Finance.
/// </summary>
[Route("api/library")][Authorize]
public sealed class ReportsController(ISender sender) : LibraryControllerBase
{
    /// <summary>
    /// Any library area's view permission gets a caller this far; the handler then checks the one
    /// the chosen report actually needs.
    /// </summary>
    [HttpGet("reports/run/{reportId}")]
    [RequirePermission("library.circulation.view", "library.catalog.view", "library.members.view", "library.fines.view")]
    public async Task<IActionResult> Run(string reportId, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunLibraryReportQuery(reportId, from, to, today), ct));

    // ── Fines collected → Finance ───────────────────────────────────────────

    [HttpGet("fines/finance/unposted")]
    [RequirePermission("library.fines.view")]
    public async Task<IActionResult> GetUnposted([FromQuery] string? through, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetUnpostedFinePaymentsQuery(through, today), ct));

    [HttpGet("fines/finance/history")]
    [RequirePermission("library.fines.view")]
    public async Task<IActionResult> GetHistory(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFinePostingHistoryQuery(), ct));

    // Putting takings into the accounts is the same level of decision as writing a fine off.
    [HttpPost("fines/finance/posted")]
    [RequirePermission("library.fines.approve")]
    public async Task<IActionResult> MarkPosted([FromBody] MarkPostedRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkFinePaymentsPostedCommand(
            req.PaymentIds ?? [], req.JournalEntryId, req.JournalEntryNumber), ct));

    public sealed record MarkPostedRequest(IReadOnlyList<Guid>? PaymentIds, Guid JournalEntryId, string? JournalEntryNumber);
}
