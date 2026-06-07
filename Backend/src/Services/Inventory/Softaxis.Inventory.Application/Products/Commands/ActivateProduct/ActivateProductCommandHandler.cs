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
            return Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));

        product.Activate();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
