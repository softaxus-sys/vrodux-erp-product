using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Queries.GetProductByBarcode;

public sealed class GetProductByBarcodeQueryHandler(IProductRepository productRepo)
    : IQueryHandler<GetProductByBarcodeQuery, ProductSummaryDto>
{
    public async Task<Result<ProductSummaryDto>> Handle(GetProductByBarcodeQuery query, CancellationToken ct)
    {
        var product = await productRepo.GetByBarcodeAsync(query.Barcode, ct);
        if (product is null)
            return Result.Failure<ProductSummaryDto>(
                Error.Custom("Product.BarcodeNotFound", $"No product found with barcode '{query.Barcode}'."));

        return Result.Success(new ProductSummaryDto(
            product.Id, product.Name, product.SKU, product.Barcode?.Value,
            product.Category?.Name ?? string.Empty,
            product.SalePrice, product.TaxRate, product.StockQuantity,
            product.Unit, product.IsActive, product.IsLowStock));
    }
}
