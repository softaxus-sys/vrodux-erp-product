using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.GetProducts;

public sealed record GetProductsQuery(
    int    Page       = 1,
    int    PageSize   = 20,
    string? Search     = null,
    Guid?   CategoryId = null,
    bool?   IsActive   = null,
    bool?   IsLowStock = null
) : IQuery<PagedResult<ProductSummaryDto>>;
