using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;
using Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogsSummary;

namespace Softaxis.Identity.API.Controllers;

[Authorize]
[Route("api/audit-logs")]
[Tags("AuditLogs")]
public sealed class AuditLogsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Query the audit log with optional filters.</summary>
    /// <param name="from">Start day on the CALLER's calendar (date-only). Converted using tzOffsetMinutes.</param>
    /// <param name="to">End day on the caller's calendar (date-only), inclusive of that whole day.</param>
    /// <param name="search">Free-text over action / entity type / IP / username.</param>
    /// <param name="tzOffsetMinutes">Caller's UTC offset in minutes (JS: -new Date().getTimezoneOffset()).</param>
    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] Guid? userId = null, [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null,
        [FromQuery] string? search = null, [FromQuery] int tzOffsetMinutes = 0,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetAuditLogsQuery(page, pageSize, userId, action, from, to, search, tzOffsetMinutes), ct));

    /// <summary>Stat counts across the whole filtered set (not just one page).</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] Guid? userId = null, [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null,
        [FromQuery] string? search = null, [FromQuery] int tzOffsetMinutes = 0,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetAuditLogsSummaryQuery(userId, action, from, to, search, tzOffsetMinutes), ct));
}
