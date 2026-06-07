using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Products.Commands.UpdateProduct;

public sealed class UpdateProductCommandHandler(
    IProductRepository  productRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<UpdateProductCommand>
{
    public async Task<Result> Handle(UpdateProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));

        var categoryExists = await productRepo.CategoryExistsAsync(cmd.CategoryId, ct);
        if (!categoryExists)
            return Result.Failure(Error.Custom("Product.Category.NotFound", "Category not found."));

        product.Update(cmd.Name, cmd.Description, cmd.SKU, cmd.Barcode,
            cmd.CategoryId, cmd.BrandId, cmd.UnitOfMeasureId,
            cmd.SalePrice, cmd.CostPrice, cmd.TaxRate,
            cmd.Unit, cmd.ReorderLevel, cmd.TrackInventory, cmd.ImageUrl);

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
