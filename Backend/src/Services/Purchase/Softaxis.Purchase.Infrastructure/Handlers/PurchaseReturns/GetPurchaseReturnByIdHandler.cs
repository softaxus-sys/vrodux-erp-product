using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.PurchaseReturns.Dtos;
using Softaxis.Purchase.Application.PurchaseReturns.Queries;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.PurchaseReturns;

internal sealed class GetPurchaseReturnByIdHandler(PurchaseDbContext db)
    : IQueryHandler<GetPurchaseReturnByIdQuery, PurchaseReturnDto>
{
    public async Task<Result<PurchaseReturnDto>> Handle(
        GetPurchaseReturnByIdQuery query, CancellationToken ct)
    {
        var purchaseReturn = await db.PurchaseReturns
            .AsNoTracking()
            .Include(x => x.PurchaseOrder)
            .Include(x => x.Vendor)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (purchaseReturn is null)
            return Result.Failure<PurchaseReturnDto>(
                Error.Custom("PurchaseReturn.NotFound", $"Purchase return '{query.Id}' was not found."));

        return Result.Success(new PurchaseReturnDto(
            purchaseReturn.Id, purchaseReturn.ReturnNumber, purchaseReturn.PurchaseOrderId,
            purchaseReturn.PurchaseOrder?.OrderNumber ?? "Unknown",
            purchaseReturn.VendorId, purchaseReturn.Vendor?.Name ?? "Unknown",
            purchaseReturn.ReturnDate, purchaseReturn.Reason, purchaseReturn.Notes, purchaseReturn.Status,
            purchaseReturn.TotalAmount,
            purchaseReturn.Items.Select(i => new PurchaseReturnItemDto(
                i.Id, i.PurchaseOrderItemId, i.ProductId, i.Description,
                i.Quantity, i.UnitCost, i.LineTotal)).ToList(),
            purchaseReturn.CreatedAt, purchaseReturn.UpdatedAt));
    }
}
