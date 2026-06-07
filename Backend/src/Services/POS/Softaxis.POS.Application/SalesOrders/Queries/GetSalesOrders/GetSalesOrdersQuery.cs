using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrders;

public sealed record GetSalesOrdersQuery(
    string? Status,
    Guid?   CustomerId,
    string? From,
    string? To,
    string? Search,
    int     Page,
    int     PageSize)
    : IQuery<PagedResult<SalesOrderSummaryDto>>;
