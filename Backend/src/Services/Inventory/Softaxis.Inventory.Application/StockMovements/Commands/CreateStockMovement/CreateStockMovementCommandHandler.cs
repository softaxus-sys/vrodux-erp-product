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
        ["Sale", "WriteOff", "Transfer", MovementTypes.ProductionIssue];

    public async Task<Result<Guid>> Handle(CreateStockMovementCommand cmd, CancellationToken ct)
    {
        // Adjustment / count-correction carry a SIGNED quantity (negative = decrease).
        // Out-movements (Sale/WriteOff/Transfer) always decrease; the rest increase.
        var delta = cmd.MovementType.Equals(MovementTypes.Adjustment, StringComparison.OrdinalIgnoreCase)
            ? cmd.Quantity
            : OutMovements.Contains(cmd.MovementType)
                ? -Math.Abs(cmd.Quantity)
                :  Math.Abs(cmd.Quantity);

        // Goods made in-house arrive at what they cost to make, so the product's cost price is
        // re-averaged. A zero cost (a by-product) leaves it alone.
        var revalue = cmd.MovementType.Equals(MovementTypes.ProductionReceipt, StringComparison.OrdinalIgnoreCase)
                      && cmd.UnitCost > 0;

        var product = await movementRepo.GetTrackedProductAsync(cmd.ProductId, ct);
        if (product is null)
        {
            if (revalue) await movementRepo.ApplyPosReceiptCostAsync(cmd.ProductId, Math.Abs(cmd.Quantity), cmd.UnitCost, ct);

            // The product picker also shows pos.products rows (see ProductReadService's
            // combined UNION) — those have no row in inventory.products and therefore no
            // FK target for stock_movements, so we can only adjust their stock quantity
            // directly rather than recording a full movement/batch trail.
            var adjusted = await movementRepo.AdjustPosProductStockAsync(cmd.ProductId, delta, ct);
            if (!adjusted)
                return Result.Failure<Guid>(Error.Custom("StockMovement.Product.NotFound", "Product not found."));

            return Result.Success(Guid.NewGuid());
        }

        if (revalue) product.ApplyReceiptCost(Math.Abs(cmd.Quantity), cmd.UnitCost);
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
