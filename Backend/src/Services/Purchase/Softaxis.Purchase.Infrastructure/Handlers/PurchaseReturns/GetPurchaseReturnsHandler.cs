using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.PurchaseReturns.Dtos;
using Softaxis.Purchase.Application.PurchaseReturns.Queries;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.PurchaseReturns;

internal sealed class GetPurchaseReturnsHandler(PurchaseDbContext db)
    : IQueryHandler<GetPurchaseReturnsQuery, IReadOnlyList<PurchaseReturnSummaryDto>>
{
    public async Task<Result<IReadOnlyList<PurchaseReturnSummaryDto>>> Handle(
        GetPurchaseReturnsQuery query, CancellationToken ct)
    {
        IQueryable<PurchaseReturn> q = db.PurchaseReturns
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
            .Select(x => new PurchaseReturnSummaryDto(
                x.Id, x.ReturnNumber, x.PurchaseOrderId,
                x.PurchaseOrder != null ? x.PurchaseOrder.OrderNumber : "Unknown",
                x.VendorId,
                x.Vendor != null ? x.Vendor.Name : "Unknown",
                x.ReturnDate, x.Reason, x.Status,
                x.Items.Sum(i => i.Quantity * i.UnitCost),
                x.Items.Count, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<PurchaseReturnSummaryDto>>(items);
    }
}
