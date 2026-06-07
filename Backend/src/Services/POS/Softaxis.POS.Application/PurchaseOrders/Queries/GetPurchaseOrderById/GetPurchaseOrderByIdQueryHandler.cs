using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrderById;

public sealed class GetPurchaseOrderByIdQueryHandler(IPurchaseOrderRepository poRepo)
    : IQueryHandler<GetPurchaseOrderByIdQuery, PurchaseOrderDto>
{
    public async Task<Result<PurchaseOrderDto>> Handle(GetPurchaseOrderByIdQuery query, CancellationToken ct)
    {
        var po = await poRepo.GetByIdAsync(query.Id, ct);
        if (po is null) return Result.Failure<PurchaseOrderDto>(Error.NotFoundById("PurchaseOrder", query.Id));

        var dto = new PurchaseOrderDto(
            po.Id, po.OrderNumber, po.VendorId, po.Vendor?.Name ?? "Unknown",
            po.Status, po.Notes, po.ExpectedDate, po.ReceivedDate,
            po.SubTotal, po.TaxAmount, po.Total,
            po.Items.Select(i => new PurchaseOrderItemDto(
                i.Id, i.ProductId, i.Description, i.Quantity,
                i.UnitCost, i.TaxRate, i.LineTotal)).ToList(),
            po.CreatedAt, po.UpdatedAt);

        return Result.Success(dto);
    }
}
