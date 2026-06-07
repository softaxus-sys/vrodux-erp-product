using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Products.Commands.DeleteProduct;

public sealed class DeleteProductCommandHandler(
    IProductRepository   productRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<DeleteProductCommand>
{
    public async Task<Result> Handle(DeleteProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure(Error.Custom("Product.NotFound", $"Product '{cmd.Id}' not found."));

        product.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
