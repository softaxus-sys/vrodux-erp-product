using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class POSTransactionRepository(POSDbContext db) : IPOSTransactionRepository
{
    private IQueryable<POSTransaction> FullQuery =>
        db.Transactions
            .Include(t => t.LineItems)
            .Include(t => t.Payments)
            .Include(t => t.Customer);

    public Task<POSTransaction?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        FullQuery.FirstOrDefaultAsync(t => t.Id == id, ct);

    public Task<POSTransaction?> GetByNumberAsync(string transactionNumber, CancellationToken ct = default) =>
        FullQuery.FirstOrDefaultAsync(t => t.TransactionNumber == transactionNumber, ct);

    public async Task<string> GenerateTransactionNumberAsync(CancellationToken ct = default)
    {
        // Format: TXN-YYYYMMDD-NNNN (sequential per day)
        var today     = DateTime.UtcNow.Date;
        var tomorrow  = today.AddDays(1);
        var todayCount = await db.Transactions
            .CountAsync(t => t.CompletedAt >= today && t.CompletedAt < tomorrow, ct);

        return $"TXN-{today:yyyyMMdd}-{(todayCount + 1):D4}";
    }

    public async Task<PagedResult<POSTransaction>> GetPagedAsync(
        int page, int pageSize,
        Guid? sessionId = null,
        Guid? cashierId = null,
        Guid? customerId = null,
        TransactionType? type = null,
        TransactionStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        string? search = null,
        CancellationToken ct = default)
    {
        var query = db.Transactions
            .Include(t => t.Payments)
            .Include(t => t.Customer)
            .AsNoTracking()
            .AsQueryable();

        if (sessionId.HasValue)  query = query.Where(t => t.SessionId == sessionId.Value);
        if (cashierId.HasValue)  query = query.Where(t => t.CashierId == cashierId.Value);
        if (customerId.HasValue) query = query.Where(t => t.CustomerId == customerId.Value);
        if (type.HasValue)       query = query.Where(t => t.Type == type.Value);
        if (status.HasValue)     query = query.Where(t => t.Status == status.Value);
        if (from.HasValue)       query = query.Where(t => t.CompletedAt >= from.Value);
        if (to.HasValue)         query = query.Where(t => t.CompletedAt <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(t =>
                EF.Functions.Like(t.TransactionNumber, pattern) ||
                (t.Customer != null && EF.Functions.Like(t.Customer.Name, pattern)));
        }

        query = query.OrderByDescending(t => t.CompletedAt);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<POSTransaction>.Create(items, total, page, pageSize);
    }

    public async Task<(IReadOnlyList<(int Hour, decimal Sales, int Count)> Hourly,
                       IReadOnlyList<(string Method, int Count)> Methods,
                       decimal TotalSales,
                       int TotalCount)>
        GetDailyBreakdownAsync(DateTime dayStartUtc, DateTime dayEndUtc, CancellationToken ct = default)
    {
        // Voided and refunded sales are excluded — the chart reports takings, not attempts.
        var day = db.Transactions.AsNoTracking()
            .Where(t => t.Status == TransactionStatus.Completed
                     && t.CompletedAt >= dayStartUtc
                     && t.CompletedAt <  dayEndUtc);

        var hourly = await day
            .GroupBy(t => t.CompletedAt.Hour)
            .Select(g => new { Hour = g.Key, Sales = g.Sum(t => t.TotalAmount), Count = g.Count() })
            .OrderBy(x => x.Hour)
            .ToListAsync(ct);

        // A transaction's "method" is its largest payment — split tenders would otherwise be
        // counted several times and the split would not sum to the transaction count.
        var methods = await day
            .Select(t => t.Payments.OrderByDescending(p => p.Amount).Select(p => p.Method).FirstOrDefault())
            .GroupBy(m => m)
            .Select(g => new { Method = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return (
            hourly.Select(h => (h.Hour, h.Sales, h.Count)).ToList(),
            methods.OrderByDescending(m => m.Count).Select(m => (m.Method.ToString(), m.Count)).ToList(),
            hourly.Sum(h => h.Sales),
            hourly.Sum(h => h.Count));
    }

    public void Add(POSTransaction transaction)    => db.Transactions.Add(transaction);
    public void Update(POSTransaction transaction) => db.Transactions.Update(transaction);
}
