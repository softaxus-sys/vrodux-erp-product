using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouseById;

public sealed class GetWarehouseByIdQueryHandler(IWarehouseRepository warehouseRepo)
    : IQueryHandler<GetWarehouseByIdQuery, WarehouseDto>
{
    public async Task<Result<WarehouseDto>> Handle(GetWarehouseByIdQuery query, CancellationToken ct)
    {
        var wh = await warehouseRepo.GetByIdAsync(query.Id, ct);
        if (wh is null)
            return Result.Failure<WarehouseDto>(Error.Custom("Warehouse.NotFound", $"Warehouse '{query.Id}' not found."));

        return Result.Success(new WarehouseDto(
            wh.Id, wh.Name, wh.Code, wh.Address, wh.ContactPerson, wh.Phone,
            wh.IsActive, wh.IsDefault,
            wh.StockMovements.Count(m => !m.IsDeleted),
            wh.CreatedAt, wh.UpdatedAt));
    }
}
