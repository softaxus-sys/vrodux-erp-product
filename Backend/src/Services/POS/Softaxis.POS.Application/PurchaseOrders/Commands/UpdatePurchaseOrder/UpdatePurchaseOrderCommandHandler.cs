using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrder;

public sealed class UpdatePurchaseOrderCommandHandler(
    IPurchaseOrderRepository poRepo,
    IUnitOfWork              uow)
    : ICommandHandler<UpdatePurchaseOrderCommand>
{
    public async Task<Result> Handle(UpdatePurchaseOrderCommand cmd, CancellationToken ct)
    {
        var po = await poRepo.GetByIdAsync(cmd.Id, ct);
        if (po is null) return Result.Failure(Error.NotFoundById("PurchaseOrder", cmd.Id));

        po.Update(cmd.VendorId, cmd.Notes, cmd.ExpectedDate, cmd.Status);

        po.Items.Clear();
        foreach (var item in cmd.Items)
            po.Items.Add(new PurchaseOrderItem(
                po.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitCost, item.TaxRate));

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
