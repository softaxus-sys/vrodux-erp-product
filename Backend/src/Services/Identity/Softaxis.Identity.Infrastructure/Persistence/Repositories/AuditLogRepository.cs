using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class AuditLogRepository(IdentityDbContext db) : IAuditLogRepository
{
    /// <summary>
    /// Shared filter pipeline for both the paged list and the summary counts, so the stat tiles can
    /// never disagree with the rows underneath them.
    /// </summary>
    private IQueryable<AuditLog> Filtered(
        Guid? userId, string? action, DateTime? from, DateTime? to, Guid? tenantId, string? search)
    {
        var query = db.AuditLogs.AsQueryable();

        // Scope to tenant — super-admin (tenantId == null) sees all logs
        if (tenantId.HasValue) query = query.Where(a => a.TenantId == tenantId);

        if (userId.HasValue) query = query.Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(action))
        {
            // Stored actions are "{FAMILY}_{SUBJECT}" (CREATE_USER, DELETE_USER, LOGIN_2FA_FAILED).
            // The old exact-only comparison meant every filter option except LOGIN matched nothing
            // and silently returned an empty table. Match the family too.
            var norm   = action.Trim().ToUpperInvariant();
            var prefix = norm + "_";
            query = query.Where(a => a.Action == norm || a.Action.StartsWith(prefix));
        }

        if (from.HasValue) query = query.Where(a => a.OccurredOn >= from.Value);
        if (to.HasValue)   query = query.Where(a => a.OccurredOn <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Server-side so a match on page 7 is actually reachable. The UI used to filter only the
            // 25 rows already on screen, which made search look broken.
            var term = search.Trim();
            query = query.Where(a =>
                EF.Functions.Like(a.Action, $"%{term}%") ||
                EF.Functions.Like(a.EntityType, $"%{term}%") ||
                (a.IpAddress != null && EF.Functions.Like(a.IpAddress, $"%{term}%")) ||
                (a.User != null && EF.Functions.Like(a.User.Username, $"%{term}%")));
        }

        return query;
    }

    public async Task<PagedResult<AuditLog>> GetPagedAsync(
        int page, int pageSize,
        Guid? userId = null, string? action = null,
        DateTime? from = null, DateTime? to = null,
        Guid? tenantId = null,
        string? search = null,
        CancellationToken ct = default)
    {
        var query = Filtered(userId, action, from, to, tenantId, search)
            .Include(a => a.User)
            .OrderByDescending(a => a.OccurredOn);

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<AuditLog>.Create(items, total, page, pageSize);
    }

    public async Task<(int Total, int Failed, int Today)> GetSummaryAsync(
        Guid? userId = null, string? action = null,
        DateTime? from = null, DateTime? to = null,
        Guid? tenantId = null, string? search = null,
        DateTime? todayStartUtc = null, DateTime? todayEndUtc = null,
        CancellationToken ct = default)
    {
        var query = Filtered(userId, action, from, to, tenantId, search);

        var total  = await query.CountAsync(ct);
        var failed = await query.CountAsync(a => !a.Succeeded, ct);

        // "Today" is the CALLER's day, passed in as a UTC window — the server's own date would be
        // wrong for any tenant not sitting in the server's timezone.
        var today = todayStartUtc.HasValue && todayEndUtc.HasValue
            ? await query.CountAsync(
                a => a.OccurredOn >= todayStartUtc.Value && a.OccurredOn <= todayEndUtc.Value, ct)
            : 0;

        return (total, failed, today);
    }

    public void Add(AuditLog log) => db.AuditLogs.Add(log);
}

