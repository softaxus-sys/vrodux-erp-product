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
        {
            // The Inventory list UNIONs [inventory].[products] and [pos].[products]
            // (ProductReadService), so a row on that screen may have no inventory row to
            // load. Falling through to the POS row is what stops an imported catalogue
            // item being visible in the list but impossible to change.
            // Brand and unit-of-measure are dropped here: [pos].[products] has no column for
            // either, so there is nowhere to put them.
            var updated = await productRepo.UpdatePosProductAsync(new PosProductUpdate(
                cmd.Id, cmd.Name, cmd.Description, cmd.SKU, cmd.Barcode, cmd.CategoryId,
                cmd.SalePrice, cmd.CostPrice, cmd.TaxRate, cmd.Unit,
                cmd.ReorderLevel, cmd.TrackInventory, cmd.ImageUrl), ct);

            return updated
                ? Result.Success()
                : Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));
        }

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
