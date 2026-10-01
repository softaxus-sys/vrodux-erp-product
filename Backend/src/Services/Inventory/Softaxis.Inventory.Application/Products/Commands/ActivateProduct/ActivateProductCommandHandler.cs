using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Products.Commands.ActivateProduct;

public sealed class ActivateProductCommandHandler(
    IProductRepository   productRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<ActivateProductCommand>
{
    public async Task<Result> Handle(ActivateProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
        {
            // The Inventory list UNIONs [inventory].[products] and [pos].[products]
            // (ProductReadService), so a row on that screen may have no inventory row to
            // load. Falling through to the POS row is what stops an imported catalogue
            // item being visible in the list but impossible to change.
            var changed = await productRepo.SetPosProductActiveAsync(cmd.Id, true, ct);
            return changed
                ? Result.Success()
                : Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));
        }

        product.Activate();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
