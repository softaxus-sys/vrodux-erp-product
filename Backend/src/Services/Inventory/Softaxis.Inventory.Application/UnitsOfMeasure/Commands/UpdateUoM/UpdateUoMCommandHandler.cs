using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.UpdateUoM;

public sealed class UpdateUoMCommandHandler(
    IUnitOfMeasureRepository uomRepo,
    IInventoryUnitOfWork     uow)
    : ICommandHandler<UpdateUoMCommand>
{
    public async Task<Result> Handle(UpdateUoMCommand cmd, CancellationToken ct)
    {
        var uom = await uomRepo.GetByIdAsync(cmd.Id, ct);
        if (uom is null)
            return Result.Failure(Error.Custom("UoM.NotFound", $"Unit of measure '{cmd.Id}' not found."));

        var symbolExists = await uomRepo.ExistsBySymbolAsync(cmd.Symbol, cmd.Id, ct);
        if (symbolExists)
            return Result.Failure(Error.Custom("UoM.Conflict", $"A unit with symbol '{cmd.Symbol}' already exists."));

        uom.Update(cmd.Name, cmd.Symbol, cmd.Description, cmd.IsActive);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
