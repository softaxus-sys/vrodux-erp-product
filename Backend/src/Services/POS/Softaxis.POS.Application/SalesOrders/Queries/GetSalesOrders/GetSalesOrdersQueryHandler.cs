using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrders;

public sealed class GetSalesOrdersQueryHandler(ISalesOrderRepository soRepo)
    : IQueryHandler<GetSalesOrdersQuery, PagedResult<SalesOrderSummaryDto>>
{
    public async Task<Result<PagedResult<SalesOrderSummaryDto>>> Handle(
        GetSalesOrdersQuery query, CancellationToken ct)
    {
        DateTime? from = DateTime.TryParse(query.From, out var f) ? f           : null;
        DateTime? to   = DateTime.TryParse(query.To,   out var t) ? t.AddDays(1) : null;

        var paged = await soRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.Status, query.CustomerId, query.Search,
            from, to, ct);

        var dtos = paged.Items.Select(so => new SalesOrderSummaryDto(
            so.Id, so.OrderNumber, so.CustomerId, so.CustomerName,
            so.Status, so.ExpectedDate, so.DeliveredDate,
            so.Total, so.Items.Count,
            so.CreatedAt, so.UpdatedAt)).ToList();

        return Result.Success(
            PagedResult<SalesOrderSummaryDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
