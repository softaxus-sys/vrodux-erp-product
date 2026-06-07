using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Commands.UpdateProduct;

public sealed class UpdateProductCommandHandler(
    IProductRepository         productRepo,
    IProductCategoryRepository categoryRepo,
    IUnitOfWork                uow)
    : ICommandHandler<UpdateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(UpdateProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure<ProductDto>(Error.NotFoundById("Product", cmd.Id));

        var category = await categoryRepo.GetByIdAsync(cmd.CategoryId, ct);
        if (category is null)
            return Result.Failure<ProductDto>(Error.NotFoundById("Category", cmd.CategoryId));

        if (!string.IsNullOrWhiteSpace(cmd.Barcode))
        {
            var barcodeExists = await productRepo.BarcodeExistsAsync(cmd.Barcode, cmd.Id, ct);
            if (barcodeExists)
                return Result.Failure<ProductDto>(Error.Custom("Product.BarcodeTaken", $"Barcode '{cmd.Barcode}' is already in use."));
        }

        if (!string.IsNullOrWhiteSpace(cmd.SKU))
        {
            var skuExists = await productRepo.SkuExistsAsync(cmd.SKU, cmd.Id, ct);
            if (skuExists)
                return Result.Failure<ProductDto>(Error.Custom("Product.SKUTaken", $"SKU '{cmd.SKU}' is already in use."));
        }

        var result = product.Update(
            cmd.Name, cmd.Description, cmd.SKU, cmd.Barcode,
            cmd.CategoryId, cmd.SalePrice, cmd.CostPrice,
            cmd.TaxRate, cmd.Unit, cmd.ReorderLevel, cmd.TrackInventory, cmd.ImageUrl);

        if (result.IsFailure)
            return Result.Failure<ProductDto>(result.Error);

        if (cmd.IsActive) product.Activate(); else product.Deactivate();

        productRepo.Update(product);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new ProductDto(
            product.Id, product.Name, product.Description, product.SKU,
            product.Barcode?.Value, product.CategoryId, category.Name,
            product.SalePrice, product.CostPrice, product.TaxRate,
            product.Unit, product.StockQuantity, product.ReorderLevel,
            product.TrackInventory, product.IsActive, product.IsLowStock,
            product.ImageUrl, product.CreatedAt, product.UpdatedAt));
    }
}
