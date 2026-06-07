using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class POSSessionRepository(POSDbContext db) : IPOSSessionRepository
{
    public Task<POSSession?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Sessions
            .Include(s => s.Transactions)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    public Task<POSSession?> GetActiveByRegisterAsync(string registerId, CancellationToken ct = default) =>
        db.Sessions.FirstOrDefaultAsync(s =>
            s.RegisterId == registerId &&
            (s.Status == SessionStatus.Open || s.Status == SessionStatus.Suspended), ct);

    public Task<POSSession?> GetActiveByUserAsync(Guid cashierId, CancellationToken ct = default) =>
        db.Sessions.FirstOrDefaultAsync(s =>
            s.CashierId == cashierId &&
            (s.Status == SessionStatus.Open || s.Status == SessionStatus.Suspended), ct);

    public async Task<PagedResult<POSSession>> GetPagedAsync(
        int page, int pageSize,
        Guid? cashierId = null,
        SessionStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default)
    {
        var query = db.Sessions.AsNoTracking().AsQueryable();

        if (cashierId.HasValue)  query = query.Where(s => s.CashierId == cashierId.Value);
        if (status.HasValue)     query = query.Where(s => s.Status == status.Value);
        if (from.HasValue)       query = query.Where(s => s.OpenedAt >= from.Value);
        if (to.HasValue)         query = query.Where(s => s.OpenedAt <= to.Value);

        query = query.OrderByDescending(s => s.OpenedAt);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<POSSession>.Create(items, total, page, pageSize);
    }

    public void Add(POSSession session)    => db.Sessions.Add(session);
    public void Update(POSSession session) => db.Sessions.Update(session);
}
