using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrderStatus;

public sealed class UpdatePurchaseOrderStatusCommandHandler(
    IPurchaseOrderRepository poRepo,
    IUnitOfWork              uow)
    : ICommandHandler<UpdatePurchaseOrderStatusCommand>
{
    public async Task<Result> Handle(UpdatePurchaseOrderStatusCommand cmd, CancellationToken ct)
    {
        var po = await poRepo.GetByIdAsync(cmd.Id, ct);
        if (po is null) return Result.Failure(Error.NotFoundById("PurchaseOrder", cmd.Id));

        po.UpdateStatus(cmd.Status);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
