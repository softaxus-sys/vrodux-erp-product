using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Queries;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.GoodsReceiptNotes;

internal sealed class GetGoodsReceiptNoteByIdHandler(PurchaseDbContext db)
    : IQueryHandler<GetGoodsReceiptNoteByIdQuery, GoodsReceiptNoteDto>
{
    public async Task<Result<GoodsReceiptNoteDto>> Handle(
        GetGoodsReceiptNoteByIdQuery query, CancellationToken ct)
    {
        var grn = await db.GoodsReceiptNotes
            .AsNoTracking()
            .Include(x => x.PurchaseOrder)
            .Include(x => x.Vendor)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (grn is null)
            return Result.Failure<GoodsReceiptNoteDto>(
                Error.Custom("GoodsReceiptNote.NotFound", $"Goods receipt note '{query.Id}' was not found."));

        return Result.Success(new GoodsReceiptNoteDto(
            grn.Id, grn.GrnNumber, grn.PurchaseOrderId,
            grn.PurchaseOrder?.OrderNumber ?? "Unknown",
            grn.VendorId, grn.Vendor?.Name ?? "Unknown",
            grn.GrnDate, grn.DriverName, grn.Notes, grn.Status,
            grn.Items.Select(i => new GoodsReceiptNoteItemDto(
                i.Id, i.PurchaseOrderItemId, i.ProductId, i.Description,
                i.OrderedQuantity, i.ReceivedQuantity, i.UnitCost, i.LineTotal)).ToList(),
            grn.CreatedAt, grn.UpdatedAt));
    }
}
