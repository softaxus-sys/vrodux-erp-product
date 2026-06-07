using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.CreatePurchaseOrder;

public sealed class CreatePurchaseOrderCommandHandler(
    IPurchaseOrderRepository poRepo,
    IUnitOfWork              uow)
    : ICommandHandler<CreatePurchaseOrderCommand, PurchaseOrderDto>
{
    public async Task<Result<PurchaseOrderDto>> Handle(CreatePurchaseOrderCommand cmd, CancellationToken ct)
    {
        if (!await poRepo.VendorExistsAsync(cmd.VendorId, ct))
            return Result.Failure<PurchaseOrderDto>(
                Error.Custom("Vendor.NotFound", "Vendor not found."));

        var po = new PurchaseOrder(cmd.VendorId, cmd.Notes, cmd.ExpectedDate);

        foreach (var item in cmd.Items)
            po.Items.Add(new PurchaseOrderItem(
                po.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitCost, item.TaxRate));

        poRepo.Add(po);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new PurchaseOrderDto(
            po.Id, po.OrderNumber, po.VendorId, string.Empty,
            po.Status, po.Notes, po.ExpectedDate, po.ReceivedDate,
            po.SubTotal, po.TaxAmount, po.Total,
            po.Items.Select(i => new PurchaseOrderItemDto(
                i.Id, i.ProductId, i.Description, i.Quantity,
                i.UnitCost, i.TaxRate, i.LineTotal)).ToList(),
            po.CreatedAt, po.UpdatedAt));
    }
}
