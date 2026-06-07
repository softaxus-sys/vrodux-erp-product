using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.CreateUoM;

public sealed class CreateUoMCommandHandler(
    IUnitOfMeasureRepository uomRepo,
    IInventoryUnitOfWork     uow)
    : ICommandHandler<CreateUoMCommand, UnitOfMeasureDto>
{
    public async Task<Result<UnitOfMeasureDto>> Handle(CreateUoMCommand cmd, CancellationToken ct)
    {
        var symbolExists = await uomRepo.ExistsBySymbolAsync(cmd.Symbol, null, ct);
        if (symbolExists)
            return Result.Failure<UnitOfMeasureDto>(
                Error.Custom("UoM.Conflict", $"A unit with symbol '{cmd.Symbol}' already exists."));

        var uom = new UnitOfMeasure(cmd.Name, cmd.Symbol, cmd.Description);
        uomRepo.Add(uom);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new UnitOfMeasureDto(
            uom.Id, uom.Name, uom.Symbol, uom.Description,
            uom.IsActive, 0, uom.CreatedAt, uom.UpdatedAt));
    }
}
