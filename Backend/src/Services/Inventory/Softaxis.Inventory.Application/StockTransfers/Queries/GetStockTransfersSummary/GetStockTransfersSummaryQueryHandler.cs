using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfersSummary;

public sealed class GetStockTransfersSummaryQueryHandler(IStockTransferRepository repo)
    : IQueryHandler<GetStockTransfersSummaryQuery, StockTransferSummaryDto>
{
    public async Task<Result<StockTransferSummaryDto>> Handle(GetStockTransfersSummaryQuery query, CancellationToken ct)
    {
        var s = await repo.GetSummaryAsync(ct);

        return Result.Success(new StockTransferSummaryDto(
            Total:      s.Total,
            Draft:      s.Draft,
            Pending:    s.Pending,
            InTransit:  s.InTransit,
            Received:   s.Received,
            Cancelled:  s.Cancelled,
            TotalValue: s.TotalValue));
    }
}
