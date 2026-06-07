using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Commands.CreateWarehouse;

public sealed class CreateWarehouseCommandHandler(
    IWarehouseRepository warehouseRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<CreateWarehouseCommand, WarehouseDto>
{
    public async Task<Result<WarehouseDto>> Handle(CreateWarehouseCommand cmd, CancellationToken ct)
    {
        var wh = new Warehouse(cmd.Name, cmd.Code, cmd.Address, cmd.ContactPerson, cmd.Phone);
        if (!cmd.IsActive) wh.Update(cmd.Name, cmd.Code, cmd.Address, cmd.ContactPerson, cmd.Phone, false);

        // First warehouse becomes default automatically
        if (!await warehouseRepo.AnyAsync(ct)) wh.SetDefault();

        warehouseRepo.Add(wh);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new WarehouseDto(
            wh.Id, wh.Name, wh.Code, wh.Address, wh.ContactPerson, wh.Phone,
            wh.IsActive, wh.IsDefault, 0, wh.CreatedAt, wh.UpdatedAt));
    }
}
