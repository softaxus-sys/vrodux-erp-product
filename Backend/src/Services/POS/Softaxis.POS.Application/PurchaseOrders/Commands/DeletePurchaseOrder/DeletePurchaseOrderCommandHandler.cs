using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.DeletePurchaseOrder;

public sealed class DeletePurchaseOrderCommandHandler(
    IPurchaseOrderRepository poRepo,
    IUnitOfWork              uow)
    : ICommandHandler<DeletePurchaseOrderCommand>
{
    public async Task<Result> Handle(DeletePurchaseOrderCommand cmd, CancellationToken ct)
    {
        var po = await poRepo.GetByIdAsync(cmd.Id, ct);
        if (po is null) return Result.Failure(Error.NotFoundById("PurchaseOrder", cmd.Id));

        po.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
