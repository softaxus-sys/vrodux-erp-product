using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Products.Commands.DeactivateProduct;

public sealed class DeactivateProductCommandHandler(
    IProductRepository   productRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<DeactivateProductCommand>
{
    public async Task<Result> Handle(DeactivateProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));

        product.Deactivate();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
