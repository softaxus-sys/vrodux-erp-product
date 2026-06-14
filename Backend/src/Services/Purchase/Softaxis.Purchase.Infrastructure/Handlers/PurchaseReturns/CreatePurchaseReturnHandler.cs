using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.PurchaseReturns.Commands;
using Softaxis.Purchase.Application.PurchaseReturns.Dtos;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.PurchaseReturns;

internal sealed class CreatePurchaseReturnHandler(PurchaseDbContext db)
    : ICommandHandler<CreatePurchaseReturnCommand, PurchaseReturnDto>
{
    public async Task<Result<PurchaseReturnDto>> Handle(
        CreatePurchaseReturnCommand cmd, CancellationToken ct)
    {
        var order = await db.PurchaseOrders
            .Include(x => x.Vendor)
            .FirstOrDefaultAsync(x => x.Id == cmd.PurchaseOrderId, ct);

        if (order is null)
            return Result.Failure<PurchaseReturnDto>(
                Error.Custom("PurchaseReturn.NotFound", $"Purchase order '{cmd.PurchaseOrderId}' was not found."));

        if (order.Status is "cancelled")
            return Result.Failure<PurchaseReturnDto>(
                Error.Custom("PurchaseReturn.Conflict", "Cannot record a return against a cancelled purchase order."));

        var purchaseReturn = new PurchaseReturn(order.Id, order.VendorId, cmd.ReturnDate, cmd.Reason, cmd.Notes);

        foreach (var item in cmd.Items)
            purchaseReturn.AddItem(item.PurchaseOrderItemId, item.ProductId, item.Description,
                item.Quantity, item.UnitCost);

        db.PurchaseReturns.Add(purchaseReturn);

        await db.SaveChangesAsync(ct);

        return Result.Success(new PurchaseReturnDto(
            purchaseReturn.Id, purchaseReturn.ReturnNumber, purchaseReturn.PurchaseOrderId, order.OrderNumber,
            purchaseReturn.VendorId, order.Vendor?.Name ?? "Unknown",
            purchaseReturn.ReturnDate, purchaseReturn.Reason, purchaseReturn.Notes, purchaseReturn.Status,
            purchaseReturn.TotalAmount,
            purchaseReturn.Items.Select(i => new PurchaseReturnItemDto(
                i.Id, i.PurchaseOrderItemId, i.ProductId, i.Description,
                i.Quantity, i.UnitCost, i.LineTotal)).ToList(),
            purchaseReturn.CreatedAt, purchaseReturn.UpdatedAt));
    }
}
