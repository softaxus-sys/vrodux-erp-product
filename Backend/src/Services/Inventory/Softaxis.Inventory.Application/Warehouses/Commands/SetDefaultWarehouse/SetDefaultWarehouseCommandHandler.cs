using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Commands.SetDefaultWarehouse;

public sealed class SetDefaultWarehouseCommandHandler(
    IWarehouseRepository warehouseRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<SetDefaultWarehouseCommand>
{
    public async Task<Result> Handle(SetDefaultWarehouseCommand cmd, CancellationToken ct)
    {
        var wh = await warehouseRepo.GetByIdAsync(cmd.Id, ct);
        if (wh is null)
            return Result.Failure(Error.Custom("Warehouse.NotFound", $"Warehouse '{cmd.Id}' not found."));

        wh.SetDefault();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
