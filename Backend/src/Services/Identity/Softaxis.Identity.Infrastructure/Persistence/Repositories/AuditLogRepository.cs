using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class AuditLogRepository(IdentityDbContext db) : IAuditLogRepository
{
    public async Task<PagedResult<AuditLog>> GetPagedAsync(
        int page, int pageSize,
        Guid? userId = null, string? action = null,
        DateTime? from = null, DateTime? to = null,
        Guid? tenantId = null,
        CancellationToken ct = default)
    {
        var query = db.AuditLogs.Include(a => a.User).AsQueryable();

        // Scope to tenant — super-admin (tenantId == null) sees all logs
        if (tenantId.HasValue) query = query.Where(a => a.TenantId == tenantId);

        if (userId.HasValue) query = query.Where(a => a.UserId == userId);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action == action.ToUpperInvariant());
        if (from.HasValue)  query = query.Where(a => a.OccurredOn >= from.Value);
        if (to.HasValue)    query = query.Where(a => a.OccurredOn <= to.Value);

        query = query.OrderByDescending(a => a.OccurredOn);

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<AuditLog>.Create(items, total, page, pageSize);
    }

    public void Add(AuditLog log) => db.AuditLogs.Add(log);
}

