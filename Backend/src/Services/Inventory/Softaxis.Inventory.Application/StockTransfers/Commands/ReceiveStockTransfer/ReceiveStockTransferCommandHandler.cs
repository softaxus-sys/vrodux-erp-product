using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.ReceiveStockTransfer;

public sealed class ReceiveStockTransferCommandHandler(
    IStockTransferRepository transferRepo,
    IStockMovementRepository movementRepo,
    IInventoryUnitOfWork uow) : ICommandHandler<ReceiveStockTransferCommand>
{
    public async Task<Result> Handle(ReceiveStockTransferCommand cmd, CancellationToken ct)
    {
        var transfer = await transferRepo.GetTrackedByIdAsync(cmd.Id, ct);
        if (transfer is null)
            return Result.Failure(Error.NotFoundById("StockTransfer", cmd.Id));

        if (transfer.Status == "received")
            return Result.Success();

        if (Guid.TryParse(transfer.FromWarehouseId, out var fromWh) && Guid.TryParse(transfer.ToWarehouseId, out var toWh))
        {
            foreach (var item in transfer.Items)
            {
                if (!Guid.TryParse(item.StockItemId, out var productId)) continue;
                var qty = Math.Abs(item.Quantity);

                var src = await movementRepo.GetOrCreateStockAsync(productId, fromWh, ct);
                src.Adjust(-qty);
                var dst = await movementRepo.GetOrCreateStockAsync(productId, toWh, ct);
                dst.Adjust(qty);

                movementRepo.Add(new StockMovement(productId, "Transfer", -qty, item.UnitCost, transfer.TransferNumber, $"Out → {transfer.ToWarehouseName}", transfer.FromWarehouseId));
                movementRepo.Add(new StockMovement(productId, "Transfer", qty, item.UnitCost, transfer.TransferNumber, $"In ← {transfer.FromWarehouseName}", transfer.ToWarehouseId));
            }
        }

        transfer.Receive();
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
