using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotations;

public sealed record GetSalesQuotationsQuery(
    string? Status,
    Guid?   CustomerId,
    string? From,
    string? To,
    string? Search,
    int     Page,
    int     PageSize)
    : IQuery<PagedResult<SalesQuotationSummaryDto>>;
