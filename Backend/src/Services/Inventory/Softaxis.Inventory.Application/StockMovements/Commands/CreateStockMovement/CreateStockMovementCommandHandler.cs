using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;

public sealed class CreateStockMovementCommandHandler(
    IStockMovementRepository movementRepo,
    IInventoryUnitOfWork     uow)
    : ICommandHandler<CreateStockMovementCommand, Guid>
{
    private static readonly HashSet<string> OutMovements =
        ["Sale", "WriteOff", "Transfer"];

    public async Task<Result<Guid>> Handle(CreateStockMovementCommand cmd, CancellationToken ct)
    {
        var product = await movementRepo.GetTrackedProductAsync(cmd.ProductId, ct);
        if (product is null)
            return Result.Failure<Guid>(Error.Custom("StockMovement.Product.NotFound", "Product not found."));

        // Adjustment / count-correction carry a SIGNED quantity (negative = decrease).
        // Out-movements (Sale/WriteOff/Transfer) always decrease; the rest increase.
        var delta = cmd.MovementType.Equals(MovementTypes.Adjustment, StringComparison.OrdinalIgnoreCase)
            ? cmd.Quantity
            : OutMovements.Contains(cmd.MovementType)
                ? -Math.Abs(cmd.Quantity)
                :  Math.Abs(cmd.Quantity);

        product.AdjustStock(delta);

        // Keep the per-warehouse bucket in sync when a warehouse is specified.
        if (cmd.WarehouseId is { } whId)
        {
            var bucket = await movementRepo.GetOrCreateStockAsync(cmd.ProductId, whId, ct);
            bucket.Adjust(delta);

            // Track batch / expiry when a batch reference is supplied.
            if (!string.IsNullOrWhiteSpace(cmd.BatchNumber))
            {
                var batch = await movementRepo.GetOrCreateBatchAsync(cmd.ProductId, whId, cmd.BatchNumber.Trim(), cmd.UnitCost, ct);
                batch.Adjust(delta);
                if (cmd.ExpiryDate is not null) batch.SetExpiry(cmd.ExpiryDate);
            }
        }

        var movement = new StockMovement(
            cmd.ProductId, cmd.MovementType, cmd.Quantity,
            cmd.UnitCost, cmd.Reference, cmd.Notes,
            cmd.WarehouseId?.ToString());

        movementRepo.Add(movement);
        await uow.SaveChangesAsync(ct);

        return Result.Success(movement.Id);
    }
}
