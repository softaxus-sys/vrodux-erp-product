using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.SubmitStockTransfer;

public sealed class SubmitStockTransferCommandHandler(IStockTransferRepository repo, IInventoryUnitOfWork uow)
    : ICommandHandler<SubmitStockTransferCommand>
{
    public async Task<Result> Handle(SubmitStockTransferCommand cmd, CancellationToken ct)
    {
        var transfer = await repo.GetTrackedByIdAsync(cmd.Id, ct);
        if (transfer is null)
            return Result.Failure(Error.NotFoundById("StockTransfer", cmd.Id));

        transfer.Submit();
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
