using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrders;

public sealed class GetPurchaseOrdersQueryHandler(IPurchaseOrderRepository poRepo)
    : IQueryHandler<GetPurchaseOrdersQuery, PagedResult<PurchaseOrderSummaryDto>>
{
    public async Task<Result<PagedResult<PurchaseOrderSummaryDto>>> Handle(
        GetPurchaseOrdersQuery query, CancellationToken ct)
    {
        DateTime? from = DateTime.TryParse(query.From, out var f) ? f           : null;
        DateTime? to   = DateTime.TryParse(query.To,   out var t) ? t.AddDays(1) : null;

        var paged = await poRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.Status, query.VendorId, query.Search,
            from, to, ct);

        var dtos = paged.Items.Select(po => new PurchaseOrderSummaryDto(
            po.Id, po.OrderNumber, po.VendorId, po.Vendor?.Name ?? "Unknown",
            po.Status, po.ExpectedDate, po.ReceivedDate,
            po.Total, po.Items.Count,
            po.CreatedAt, po.UpdatedAt)).ToList();

        return Result.Success(
            PagedResult<PurchaseOrderSummaryDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
