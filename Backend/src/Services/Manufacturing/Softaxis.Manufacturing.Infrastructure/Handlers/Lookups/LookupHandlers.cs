using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Application.Lookups.Queries;

namespace Softaxis.Manufacturing.Infrastructure.Handlers.Lookups;

internal sealed class GetStockItemsHandler(IManufacturingStock stock)
    : IQueryHandler<GetStockItemsQuery, IReadOnlyList<StockItem>>
{
    public async Task<Result<IReadOnlyList<StockItem>>> Handle(GetStockItemsQuery q, CancellationToken ct) =>
        Result.Success(await stock.SearchItemsAsync(q.Search, 50, ct));
}

internal sealed class GetStockWarehousesHandler(IManufacturingStock stock)
    : IQueryHandler<GetStockWarehousesQuery, IReadOnlyList<StockWarehouse>>
{
    public async Task<Result<IReadOnlyList<StockWarehouse>>> Handle(GetStockWarehousesQuery q, CancellationToken ct) =>
        Result.Success(await stock.GetWarehousesAsync(ct));
}
