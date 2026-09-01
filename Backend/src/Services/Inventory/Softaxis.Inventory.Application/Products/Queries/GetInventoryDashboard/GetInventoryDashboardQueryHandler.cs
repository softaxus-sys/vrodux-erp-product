using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;

namespace Softaxis.Inventory.Application.Products.Queries.GetInventoryDashboard;

public sealed class GetInventoryDashboardQueryHandler(IProductReadService readService)
    : IQueryHandler<GetInventoryDashboardQuery, InventoryDashboardDto>
{
    public async Task<Result<InventoryDashboardDto>> Handle(
        GetInventoryDashboardQuery query, CancellationToken ct)
        => Result.Success(await readService.GetDashboardAsync(ct));
}
