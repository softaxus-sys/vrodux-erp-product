using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.StockTransfers.Dtos;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.CreateStockTransfer;

public sealed class CreateStockTransferCommandHandler(IStockTransferRepository repo, IInventoryUnitOfWork uow)
    : ICommandHandler<CreateStockTransferCommand, StockTransferDto>
{
    public async Task<Result<StockTransferDto>> Handle(CreateStockTransferCommand cmd, CancellationToken ct)
    {
        var transfer = new StockTransfer(cmd.FromWarehouseId, cmd.FromWarehouseName, cmd.ToWarehouseId,
            cmd.ToWarehouseName, cmd.RequestedBy, cmd.ExpectedDate, cmd.Notes);

        foreach (var i in cmd.Items)
            transfer.Items.Add(new StockTransferItem(transfer.Id, i.StockItemId, i.ItemName, i.Sku, i.Quantity, i.UnitCost));

        transfer.RecalcTotal();
        repo.Add(transfer);
        await uow.SaveChangesAsync(ct);

        return Result.Success(StockTransferMappings.ToDto(transfer));
    }
}
