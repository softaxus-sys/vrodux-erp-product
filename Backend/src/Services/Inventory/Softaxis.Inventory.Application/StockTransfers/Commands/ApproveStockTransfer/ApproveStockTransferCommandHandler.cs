using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.ApproveStockTransfer;

public sealed class ApproveStockTransferCommandHandler(IStockTransferRepository repo, IInventoryUnitOfWork uow)
    : ICommandHandler<ApproveStockTransferCommand>
{
    public async Task<Result> Handle(ApproveStockTransferCommand cmd, CancellationToken ct)
    {
        var transfer = await repo.GetTrackedByIdAsync(cmd.Id, ct);
        if (transfer is null)
            return Result.Failure(Error.NotFoundById("StockTransfer", cmd.Id));

        transfer.Approve(cmd.By);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
