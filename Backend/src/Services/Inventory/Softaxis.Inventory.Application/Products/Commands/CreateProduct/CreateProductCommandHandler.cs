using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Products.Commands.CreateProduct;

public sealed class CreateProductCommandHandler(
    IProductRepository       productRepo,
    ICategoryRepository      categoryRepo,
    IBrandRepository         brandRepo,
    IUnitOfMeasureRepository uomRepo,
    IStockMovementRepository movementRepo,
    IInventoryUnitOfWork     uow)
    : ICommandHandler<CreateProductCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(CreateProductCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.CategoryId, ct);
        if (category is null)
            return Result.Failure<ProductDto>(Error.Custom("Product.Category.NotFound", "Category not found."));

        Brand? brand = null;
        if (cmd.BrandId.HasValue)
        {
            brand = await brandRepo.GetByIdAsync(cmd.BrandId.Value, ct);
            if (brand is null)
                return Result.Failure<ProductDto>(Error.Custom("Product.Brand.NotFound", "Brand not found."));
        }

        UnitOfMeasure? uom = null;
        if (cmd.UnitOfMeasureId.HasValue)
        {
            uom = await uomRepo.GetByIdAsync(cmd.UnitOfMeasureId.Value, ct);
            if (uom is null)
                return Result.Failure<ProductDto>(Error.Custom("Product.UoM.NotFound", "Unit of measure not found."));
        }

        var product = new Product(
            cmd.Name, cmd.Description, cmd.SKU, cmd.Barcode,
            cmd.CategoryId, cmd.BrandId, cmd.UnitOfMeasureId,
            cmd.SalePrice, cmd.CostPrice, cmd.TaxRate,
            cmd.Unit, cmd.OpeningStock, cmd.ReorderLevel, cmd.TrackInventory, cmd.ImageUrl);

        productRepo.Add(product);

        if (cmd.OpeningStock > 0 && cmd.TrackInventory)
        {
            var movement = new StockMovement(
                product.Id, MovementTypes.Receipt, cmd.OpeningStock,
                cmd.CostPrice, "OPENING", "Opening stock", null);
            movementRepo.Add(movement);
        }

        await uow.SaveChangesAsync(ct);

        return Result.Success(new ProductDto(
            product.Id, product.Name, product.Description, product.SKU, product.Barcode,
            product.CategoryId, category.Name,
            product.BrandId, brand?.Name,
            product.UnitOfMeasureId, uom?.Symbol,
            product.SalePrice, product.CostPrice, product.TaxRate, product.Unit,
            product.StockQuantity, product.ReorderLevel,
            product.IsActive, product.TrackInventory, product.IsLowStock,
            product.ImageUrl, product.CreatedAt, product.UpdatedAt));
    }
}
