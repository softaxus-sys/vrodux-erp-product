using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Commands.CreateProduct;

public sealed class CreateProductCommandHandler(
    IProductRepository         productRepo,
    IProductCategoryRepository categoryRepo,
    IStockMovementRepository   stockRepo,
    IUnitOfWork                uow)
    : ICommandHandler<CreateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(CreateProductCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.CategoryId, ct);
        if (category is null)
            return Result.Failure<ProductDto>(Error.NotFoundById("Category", cmd.CategoryId));

        if (!string.IsNullOrWhiteSpace(cmd.Barcode))
        {
            var barcodeExists = await productRepo.BarcodeExistsAsync(cmd.Barcode, null, ct);
            if (barcodeExists)
                return Result.Failure<ProductDto>(Error.Custom("Product.BarcodeTaken", $"Barcode '{cmd.Barcode}' is already in use."));
        }

        if (!string.IsNullOrWhiteSpace(cmd.SKU))
        {
            var skuExists = await productRepo.SkuExistsAsync(cmd.SKU, null, ct);
            if (skuExists)
                return Result.Failure<ProductDto>(Error.Custom("Product.SKUTaken", $"SKU '{cmd.SKU}' is already in use."));
        }

        var result = Product.Create(
            cmd.Name, cmd.Description, cmd.SKU, cmd.Barcode,
            cmd.CategoryId, cmd.SalePrice, cmd.CostPrice,
            cmd.TaxRate, cmd.Unit, cmd.OpeningStock, cmd.ReorderLevel,
            cmd.TrackInventory, cmd.ImageUrl);

        if (result.IsFailure)
            return Result.Failure<ProductDto>(result.Error);

        var product = result.Value;
        productRepo.Add(product);

        // Record opening stock movement if tracking and opening stock > 0
        if (cmd.TrackInventory && cmd.OpeningStock > 0)
        {
            var movement = StockMovement.Create(
                product.Id, Domain.Enums.StockAdjustmentType.Opening,
                cmd.OpeningStock, cmd.OpeningStock, Guid.Empty, "Opening stock");
            stockRepo.Add(movement);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(MapToDto(product, category.Name));
    }

    private static ProductDto MapToDto(Product p, string categoryName) =>
        new(p.Id, p.Name, p.Description, p.SKU, p.Barcode?.Value,
            p.CategoryId, categoryName, p.SalePrice, p.CostPrice,
            p.TaxRate, p.Unit, p.StockQuantity, p.ReorderLevel,
            p.TrackInventory, p.IsActive, p.IsLowStock, p.ImageUrl,
            p.CreatedAt, p.UpdatedAt);
}
