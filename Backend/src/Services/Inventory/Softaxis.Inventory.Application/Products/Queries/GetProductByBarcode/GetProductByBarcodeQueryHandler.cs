using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.GetProductByBarcode;

public sealed class GetProductByBarcodeQueryHandler(IProductReadService readService)
    : IQueryHandler<GetProductByBarcodeQuery, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(GetProductByBarcodeQuery query, CancellationToken ct)
    {
        var dto = await readService.GetByBarcodeAsync(query.Barcode, ct);

        return dto is null
            ? Result.Failure<ProductDto>(Error.Custom("Product.NotFound",
                $"No product found with barcode '{query.Barcode}'."))
            : Result.Success(dto);
    }
}
