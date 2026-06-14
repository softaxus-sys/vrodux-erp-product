using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfers;

public sealed class GetStockTransfersQueryHandler(IStockTransferRepository repo)
    : IQueryHandler<GetStockTransfersQuery, IReadOnlyList<StockTransferDto>>
{
    public async Task<Result<IReadOnlyList<StockTransferDto>>> Handle(GetStockTransfersQuery query, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        return Result.Success<IReadOnlyList<StockTransferDto>>(items.Select(StockTransferMappings.ToDto).ToList());
    }
}
