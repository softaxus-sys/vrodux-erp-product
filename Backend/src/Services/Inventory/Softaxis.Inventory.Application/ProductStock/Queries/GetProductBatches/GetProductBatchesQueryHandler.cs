using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductStock.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.ProductStock.Queries.GetProductBatches;

public sealed class GetProductBatchesQueryHandler(IProductStockRepository repo)
    : IQueryHandler<GetProductBatchesQuery, IReadOnlyList<ProductBatchDto>>
{
    public async Task<Result<IReadOnlyList<ProductBatchDto>>> Handle(GetProductBatchesQuery query, CancellationToken ct)
    {
        var today   = DateTime.UtcNow.Date;
        var batches = await repo.GetBatchesByProductAsync(query.ProductId, ct);

        var rows = batches.Select(b =>
        {
            int? days = b.ExpiryDate is null ? null : (int)(b.ExpiryDate.Value.Date - today).TotalDays;
            var status = days is null ? "No expiry"
                       : days < 0 ? "Expired"
                       : days <= 30 ? "Expiring soon"
                       : "OK";
            return new ProductBatchDto(b.Id, b.Warehouse?.Name ?? "—", b.BatchNumber, b.ExpiryDate, days, b.Quantity, status);
        }).ToList();

        return Result.Success<IReadOnlyList<ProductBatchDto>>(rows);
    }
}
