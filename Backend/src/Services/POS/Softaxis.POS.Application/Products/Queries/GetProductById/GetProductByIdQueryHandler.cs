using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Queries.GetProductById;

public sealed class GetProductByIdQueryHandler(IProductRepository productRepo)
    : IQueryHandler<GetProductByIdQuery, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(GetProductByIdQuery query, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(query.Id, ct);
        if (product is null)
            return Result.Failure<ProductDto>(Error.NotFoundById("Product", query.Id));

        return Result.Success(new ProductDto(
            product.Id, product.Name, product.Description, product.SKU,
            product.Barcode?.Value, product.CategoryId,
            product.Category?.Name ?? string.Empty,
            product.SalePrice, product.CostPrice, product.TaxRate,
            product.Unit, product.StockQuantity, product.ReorderLevel,
            product.TrackInventory, product.IsActive, product.IsLowStock,
            product.ImageUrl, product.CreatedAt, product.UpdatedAt));
    }
}
