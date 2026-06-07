using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrders;

public sealed record GetPurchaseOrdersQuery(
    string?   Status,
    Guid?     VendorId,
    string?   From,
    string?   To,
    string?   Search,
    int       Page,
    int       PageSize)
    : IQuery<PagedResult<PurchaseOrderSummaryDto>>;
