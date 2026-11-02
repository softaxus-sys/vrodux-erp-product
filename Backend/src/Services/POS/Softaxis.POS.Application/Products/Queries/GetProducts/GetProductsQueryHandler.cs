using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Queries.GetProducts;

public sealed class GetProductsQueryHandler(
    IProductRepository productRepo, ICrossSchemaProductService stock, ICatalogueGateway catalogue)
    : IQueryHandler<GetProductsQuery, PagedResult<ProductSummaryDto>>
{
    public async Task<Result<PagedResult<ProductSummaryDto>>> Handle(GetProductsQuery query, CancellationToken ct)
    {
        if (await catalogue.UsesInventoryAsync(ct)) return await catalogue.GetPagedAsync(query, ct);

        var paged = await productRepo.GetPagedAsync(
            query.Page, query.PageSize, query.Search, query.CategoryId,
            query.IsActive, query.LowStock, query.SortBy, query.SortDesc, ct);

        // A branch's till shows that branch's own stock, not head office's total.
        var branchQty = query.BranchId is Guid branchId
            ? await stock.GetBranchQuantitiesAsync(branchId, paged.Items.Select(p => p.Id).ToList(), ct)
            : null;

        var dtos = paged.Items.Select(p =>
        {
            var qty = branchQty is not null && branchQty.TryGetValue(p.Id, out var own) ? own : p.StockQuantity;
            var low = branchQty is not null && branchQty.ContainsKey(p.Id)
                ? p.TrackInventory && p.ReorderLevel > 0 && qty <= p.ReorderLevel
                : p.IsLowStock;
            return new ProductSummaryDto(
                p.Id, p.Name, p.SKU, p.Barcode?.Value,
                p.Category?.Name ?? string.Empty,
                p.SalePrice, p.TaxRate, qty,
                p.Unit, p.IsActive, low);
        }).ToList();

        return Result.Success(PagedResult<ProductSummaryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
