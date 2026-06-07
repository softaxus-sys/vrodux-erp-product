using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Pagination;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Products.Queries.GetProducts;

public sealed record GetProductsQuery(
    int     Page       = 1,
    int     PageSize   = 20,
    string? Search     = null,
    Guid?   CategoryId = null,
    bool?   IsActive   = null,
    bool?   LowStock   = null,
    string? SortBy     = null,
    bool    SortDesc   = false)
    : IQuery<PagedResult<ProductSummaryDto>>;
