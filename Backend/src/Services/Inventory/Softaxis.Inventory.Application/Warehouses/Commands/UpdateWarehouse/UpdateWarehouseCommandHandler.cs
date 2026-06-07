using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Commands.UpdateWarehouse;

public sealed class UpdateWarehouseCommandHandler(
    IWarehouseRepository warehouseRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<UpdateWarehouseCommand>
{
    public async Task<Result> Handle(UpdateWarehouseCommand cmd, CancellationToken ct)
    {
        var wh = await warehouseRepo.GetByIdAsync(cmd.Id, ct);
        if (wh is null)
            return Result.Failure(Error.Custom("Warehouse.NotFound", $"Warehouse '{cmd.Id}' not found."));

        wh.Update(cmd.Name, cmd.Code, cmd.Address, cmd.ContactPerson, cmd.Phone, cmd.IsActive);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
