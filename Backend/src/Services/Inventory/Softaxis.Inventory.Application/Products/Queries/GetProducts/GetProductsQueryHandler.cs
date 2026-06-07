using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.GetProducts;

public sealed class GetProductsQueryHandler(IProductReadService readService)
    : IQueryHandler<GetProductsQuery, PagedResult<ProductSummaryDto>>
{
    public async Task<Result<PagedResult<ProductSummaryDto>>> Handle(GetProductsQuery query, CancellationToken ct)
    {
        var result = await readService.GetCombinedPagedAsync(
            query.Page,
            query.PageSize,
            query.Search,
            query.CategoryId,
            query.IsActive,
            query.IsLowStock,
            ct);

        return Result.Success(result);
    }
}
