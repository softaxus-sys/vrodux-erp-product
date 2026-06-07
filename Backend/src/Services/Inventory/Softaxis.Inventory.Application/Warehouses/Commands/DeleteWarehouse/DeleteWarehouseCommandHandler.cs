using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Warehouses.Commands.DeleteWarehouse;

public sealed class DeleteWarehouseCommandHandler(
    IWarehouseRepository warehouseRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<DeleteWarehouseCommand>
{
    public async Task<Result> Handle(DeleteWarehouseCommand cmd, CancellationToken ct)
    {
        var wh = await warehouseRepo.GetByIdAsync(cmd.Id, ct);
        if (wh is null)
            return Result.Failure(Error.Custom("Warehouse.NotFound", $"Warehouse '{cmd.Id}' not found."));

        if (wh.IsDefault)
            return Result.Failure(Error.Custom("Warehouse.Conflict", "Cannot delete the default warehouse."));

        wh.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
