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
        var all = await repo.GetSummaryDataAsync(ct);

        return Result.Success(new StockTransferSummaryDto(
            Total:      all.Count,
            Draft:      all.Count(x => x.Status == "draft"),
            Pending:    all.Count(x => x.Status == "pending"),
            InTransit:  all.Count(x => x.Status == "in_transit"),
            Received:   all.Count(x => x.Status == "received"),
            Cancelled:  all.Count(x => x.Status == "cancelled"),
            TotalValue: all.Sum(x => x.TotalValue)));
    }
}
