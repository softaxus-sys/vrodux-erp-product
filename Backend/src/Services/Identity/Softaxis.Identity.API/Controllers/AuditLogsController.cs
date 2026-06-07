using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

namespace Softaxis.Identity.API.Controllers;

[Authorize]
[Route("api/audit-logs")]
[Tags("AuditLogs")]
public sealed class AuditLogsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Query the audit log with optional filters.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] Guid? userId = null, [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetAuditLogsQuery(page, pageSize, userId, action, from, to), ct));
}
