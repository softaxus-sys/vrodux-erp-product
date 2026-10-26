using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Commands.AdjustStock;

public sealed class AdjustStockCommandHandler(
    IProductRepository       productRepo,
    IStockMovementRepository stockRepo,
    ICrossSchemaProductService productLookup,
    ICurrentUser             currentUser,
    IUnitOfWork              uow)
    : ICommandHandler<AdjustStockCommand, StockMovementDto>
{
    public async Task<Result<StockMovementDto>> Handle(AdjustStockCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.ProductId, ct);
        if (product is null)
            return Result.Failure<StockMovementDto>(Error.NotFoundById("Product", cmd.ProductId));

        if (!Enum.TryParse<StockAdjustmentType>(cmd.AdjustmentType, ignoreCase: true, out var adjustType))
            return Result.Failure<StockMovementDto>(Error.Custom("Stock.InvalidType",
                $"Invalid adjustment type '{cmd.AdjustmentType}'."));

        // A branch's own stock: that branch's row changes, head office's figure does not.
        if (cmd.BranchId is Guid branchId)
        {
            var balance = await productLookup.AdjustBranchStockAsync(
                product.Id, branchId, cmd.Quantity, adjustType.ToString(), cmd.Reference, cmd.Notes,
                currentUser.Id ?? Guid.Empty, ct);
            return Result.Success(new StockMovementDto(
                Guid.NewGuid(), product.Id, product.Name, adjustType.ToString(), cmd.Quantity,
                balance, cmd.Reference, DateTime.UtcNow, cmd.Notes));
        }

        var adjustResult = product.AdjustStock(cmd.Quantity, adjustType, cmd.Reference);
        if (adjustResult.IsFailure)
            return Result.Failure<StockMovementDto>(adjustResult.Error);

        var movement = StockMovement.Create(
            product.Id, adjustType, cmd.Quantity, product.StockQuantity,
            currentUser.Id ?? Guid.Empty, cmd.Reference, null, cmd.Notes);

        stockRepo.Add(movement);
        productRepo.Update(product);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new StockMovementDto(
            movement.Id, product.Id, product.Name,
            movement.AdjustmentType.ToString(), movement.Quantity,
            movement.BalanceAfter, movement.Reference,
            movement.CreatedAt, movement.Notes));
    }
}
