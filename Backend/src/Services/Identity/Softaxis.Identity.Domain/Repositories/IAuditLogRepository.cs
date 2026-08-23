using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IAuditLogRepository
{
    /// <param name="action">
    /// Action family or exact action. Matched as "equals OR starts with '{action}_'", so "CREATE"
    /// finds "CREATE_USER". Stored actions are families with a subject suffix (CREATE_USER,
    /// DELETE_USER, LOGIN_2FA_FAILED…), so an exact-only match returned nothing for every filter
    /// option except LOGIN.
    /// </param>
    /// <param name="search">Free-text over action / entity type / IP / username. Null to skip.</param>
    /// <param name="to">
    /// INCLUSIVE upper bound. A date-only value (midnight) is widened to the end of that day by the
    /// caller — see <c>GetAuditLogsQueryHandler</c> — so "to = today" includes today's entries.
    /// </param>
    Task<PagedResult<AuditLog>> GetPagedAsync(
        int page, int pageSize,
        Guid? userId = null,
        string? action = null,
        DateTime? from = null, DateTime? to = null,
        Guid? tenantId = null,
        string? search = null,
        CancellationToken ct = default);

    /// <summary>Counts across the WHOLE filtered set, not just the requested page.</summary>
    Task<(int Total, int Failed, int Today)> GetSummaryAsync(
        Guid? userId = null,
        string? action = null,
        DateTime? from = null, DateTime? to = null,
        Guid? tenantId = null,
        string? search = null,
        DateTime? todayStartUtc = null, DateTime? todayEndUtc = null,
        CancellationToken ct = default);

    void Add(AuditLog log);
}

