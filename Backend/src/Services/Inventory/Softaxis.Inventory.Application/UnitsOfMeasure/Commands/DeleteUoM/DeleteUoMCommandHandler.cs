using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.DeleteUoM;

public sealed class DeleteUoMCommandHandler(
    IUnitOfMeasureRepository uomRepo,
    IInventoryUnitOfWork     uow)
    : ICommandHandler<DeleteUoMCommand>
{
    public async Task<Result> Handle(DeleteUoMCommand cmd, CancellationToken ct)
    {
        var uom = await uomRepo.GetByIdAsync(cmd.Id, ct);
        if (uom is null)
            return Result.Failure(Error.Custom("UoM.NotFound", $"Unit of measure '{cmd.Id}' not found."));

        var hasProducts = await uomRepo.HasProductsAsync(cmd.Id, ct);
        if (hasProducts)
            return Result.Failure(Error.Custom("UoM.InUse", "Cannot delete a unit of measure that is assigned to products."));

        uom.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
