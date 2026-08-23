using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogsSummary;

/// <summary>
/// Stat-tile counts over the WHOLE filtered set. The UI previously derived "Failed" and "Today"
/// from the 25 rows on screen while showing a server-side "Total" beside them — so a screen full of
/// successes reported "Failed: 0" even when failures existed on another page, which is exactly the
/// signal a security log exists to surface.
/// </summary>
public sealed record GetAuditLogsSummaryQuery(
    Guid?     UserId          = null,
    string?   Action          = null,
    DateTime? From            = null,
    DateTime? To              = null,
    string?   Search          = null,
    int       TzOffsetMinutes = 0
) : IQuery<AuditLogSummaryDto>;
