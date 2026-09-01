using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfers;

public sealed class GetStockTransfersQueryHandler(IStockTransferRepository repo)
    : IQueryHandler<GetStockTransfersQuery, PagedResult<StockTransferDto>>
{
    public async Task<Result<PagedResult<StockTransferDto>>> Handle(GetStockTransfersQuery query, CancellationToken ct)
    {
        var (items, total) = await repo.GetPagedAsync(
            query.Status, query.Search, query.Page, query.PageSize, ct);

        return Result.Success(PagedResult<StockTransferDto>.Create(
            items.Select(StockTransferMappings.ToDto).ToList(), total, query.Page, query.PageSize));
    }
}
