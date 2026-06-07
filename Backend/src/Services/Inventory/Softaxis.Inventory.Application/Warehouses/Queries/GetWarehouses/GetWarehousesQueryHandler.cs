using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouses;

public sealed class GetWarehousesQueryHandler(IWarehouseRepository warehouseRepo)
    : IQueryHandler<GetWarehousesQuery, IReadOnlyList<WarehouseDto>>
{
    public async Task<Result<IReadOnlyList<WarehouseDto>>> Handle(GetWarehousesQuery query, CancellationToken ct)
    {
        var items = await warehouseRepo.GetAllAsync(ct);

        var dtos = items.Select(wh => new WarehouseDto(
            wh.Id, wh.Name, wh.Code, wh.Address, wh.ContactPerson, wh.Phone,
            wh.IsActive, wh.IsDefault,
            wh.StockMovements.Count(m => !m.IsDeleted),
            wh.CreatedAt, wh.UpdatedAt))
            .ToList();

        return Result.Success<IReadOnlyList<WarehouseDto>>(dtos);
    }
}
