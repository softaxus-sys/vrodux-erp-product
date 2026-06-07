using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotations;

public sealed class GetSalesQuotationsQueryHandler(ISalesQuotationRepository sqRepo)
    : IQueryHandler<GetSalesQuotationsQuery, PagedResult<SalesQuotationSummaryDto>>
{
    public async Task<Result<PagedResult<SalesQuotationSummaryDto>>> Handle(
        GetSalesQuotationsQuery query, CancellationToken ct)
    {
        DateTime? from = DateTime.TryParse(query.From, out var f) ? f           : null;
        DateTime? to   = DateTime.TryParse(query.To,   out var t) ? t.AddDays(1) : null;

        var paged = await sqRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.Status, query.CustomerId, query.Search,
            from, to, ct);

        var dtos = paged.Items.Select(sq => new SalesQuotationSummaryDto(
            sq.Id, sq.QuotationNumber, sq.CustomerId, sq.CustomerName,
            sq.Status, sq.ValidUntil,
            sq.Total, sq.Items.Count,
            sq.CreatedAt, sq.UpdatedAt)).ToList();

        return Result.Success(
            PagedResult<SalesQuotationSummaryDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
