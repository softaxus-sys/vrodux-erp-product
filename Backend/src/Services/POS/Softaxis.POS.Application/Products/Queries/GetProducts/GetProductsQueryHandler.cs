using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Queries.GetProducts;

public sealed class GetProductsQueryHandler(IProductRepository productRepo)
    : IQueryHandler<GetProductsQuery, PagedResult<ProductSummaryDto>>
{
    public async Task<Result<PagedResult<ProductSummaryDto>>> Handle(GetProductsQuery query, CancellationToken ct)
    {
        var paged = await productRepo.GetPagedAsync(
            query.Page, query.PageSize, query.Search, query.CategoryId,
            query.IsActive, query.LowStock, query.SortBy, query.SortDesc, ct);

        var dtos = paged.Items.Select(p => new ProductSummaryDto(
            p.Id, p.Name, p.SKU, p.Barcode?.Value,
            p.Category?.Name ?? string.Empty,
            p.SalePrice, p.TaxRate, p.StockQuantity,
            p.Unit, p.IsActive, p.IsLowStock)).ToList();

        return Result.Success(PagedResult<ProductSummaryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
