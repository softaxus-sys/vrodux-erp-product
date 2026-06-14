using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Queries;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.GoodsReceiptNotes;

internal sealed class GetGoodsReceiptNotesHandler(PurchaseDbContext db)
    : IQueryHandler<GetGoodsReceiptNotesQuery, IReadOnlyList<GoodsReceiptNoteSummaryDto>>
{
    public async Task<Result<IReadOnlyList<GoodsReceiptNoteSummaryDto>>> Handle(
        GetGoodsReceiptNotesQuery query, CancellationToken ct)
    {
        IQueryable<GoodsReceiptNote> q = db.GoodsReceiptNotes
            .AsNoTracking()
            .Include(x => x.PurchaseOrder)
            .Include(x => x.Vendor)
            .Include(x => x.Items);

        if (query.PurchaseOrderId.HasValue)
            q = q.Where(x => x.PurchaseOrderId == query.PurchaseOrderId.Value);

        if (query.VendorId.HasValue)
            q = q.Where(x => x.VendorId == query.VendorId.Value);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new GoodsReceiptNoteSummaryDto(
                x.Id, x.GrnNumber, x.PurchaseOrderId,
                x.PurchaseOrder != null ? x.PurchaseOrder.OrderNumber : "Unknown",
                x.VendorId,
                x.Vendor != null ? x.Vendor.Name : "Unknown",
                x.GrnDate, x.DriverName, x.Status, x.Items.Count, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<GoodsReceiptNoteSummaryDto>>(items);
    }
}
