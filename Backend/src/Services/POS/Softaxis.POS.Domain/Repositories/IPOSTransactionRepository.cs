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

    void Add(POSTransaction transaction);
    void Update(POSTransaction transaction);
}
