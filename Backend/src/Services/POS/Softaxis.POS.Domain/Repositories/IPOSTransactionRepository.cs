using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Repositories;

public interface IPOSTransactionRepository
{
    Task<POSTransaction?>  GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<POSTransaction?>  GetByNumberAsync(string transactionNumber, CancellationToken ct = default);
    Task<string>           GenerateTransactionNumberAsync(CancellationToken ct = default);

    Task<PagedResult<POSTransaction>> GetPagedAsync(
        int page, int pageSize,
        Guid? sessionId = null,
        Guid? cashierId = null,
        Guid? customerId = null,
        TransactionType? type = null,
        TransactionStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        string? search = null,
        CancellationToken ct = default);

    /// <summary>
    /// Completed sales on one local day, bucketed by hour, plus the payment-method split over the
    /// same day. Aggregated in the database — the dashboard used to read a 500-row page of
    /// transactions and total it in the browser, which past 500 described a subset.
    /// </summary>
    Task<(IReadOnlyList<(int Hour, decimal Sales, int Count)> Hourly,
          IReadOnlyList<(string Method, int Count)> Methods,
          decimal TotalSales,
          int TotalCount)>
        GetDailyBreakdownAsync(DateTime dayStartUtc, DateTime dayEndUtc, CancellationToken ct = default);

    void Add(POSTransaction transaction);
    void Update(POSTransaction transaction);
}
