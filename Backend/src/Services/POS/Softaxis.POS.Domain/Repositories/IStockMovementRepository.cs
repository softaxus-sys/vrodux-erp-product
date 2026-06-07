using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Repositories;

public interface IStockMovementRepository
{
    Task<PagedResult<StockMovement>> GetPagedAsync(
        int page, int pageSize,
        Guid? productId = null,
        StockAdjustmentType? type = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default);

    void Add(StockMovement movement);
}
