using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.ProductStock.Dtos;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.ProductStock.Queries.GetProductStockByProduct;

public sealed class GetProductStockByProductQueryHandler(IProductStockRepository repo)
    : IQueryHandler<GetProductStockByProductQuery, ProductStockSummaryDto>
{
    public async Task<Result<ProductStockSummaryDto>> Handle(GetProductStockByProductQuery query, CancellationToken ct)
    {
        var warehouses = await repo.GetActiveWarehousesAsync(ct);
        var stocks     = await repo.GetStocksByProductAsync(query.ProductId, ct);

        var rows = warehouses.Select(w =>
        {
            var s     = stocks.FirstOrDefault(x => x.WarehouseId == w.Id);
            var qty   = s?.Quantity ?? 0m;
            var level = s?.ReorderLevel ?? 0m;
            return new WarehouseStockDto(
                w.Id, w.Name, w.Code, qty, level,
                level > 0 && qty <= level, w.IsDefault);
        }).ToList();

        return Result.Success(new ProductStockSummaryDto(query.ProductId, rows.Sum(r => r.Quantity), rows));
    }
}
