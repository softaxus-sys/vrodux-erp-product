using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

public sealed record GetAuditLogsQuery(
    int       Page     = 1,
    int       PageSize = 20,
    Guid?     UserId   = null,
    string?   Action   = null,
    DateTime? From     = null,
    DateTime? To       = null,
    string?   Search   = null,
    /// <summary>
    /// Caller's UTC offset in minutes (JS `-new Date().getTimezoneOffset()`), e.g. 240 for GST.
    /// Used to turn the date-only From/To — which the user picked on THEIR calendar — into the
    /// right UTC instants, and to count "today" in the caller's day rather than the server's.
    /// </summary>
    int       TzOffsetMinutes = 0
) : IQuery<PagedResult<AuditLogDto>>;

