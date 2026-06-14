using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransferById;

public sealed class GetStockTransferByIdQueryHandler(IStockTransferRepository repo)
    : IQueryHandler<GetStockTransferByIdQuery, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> Handle(GetStockTransferByIdQuery query, CancellationToken ct)
    {
        var transfer = await repo.GetByIdAsync(query.Id, ct);
        if (transfer is null)
            return Result.Failure<StockTransferDto>(Error.NotFoundById("StockTransfer", query.Id));

        return Result.Success(StockTransferMappings.ToDto(transfer));
    }
}
