using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Commands.DeleteProduct;

public sealed class DeleteProductCommandHandler(
    IProductRepository productRepo,
    IUnitOfWork        uow)
    : ICommandHandler<DeleteProductCommand>
{
    public async Task<Result> Handle(DeleteProductCommand cmd, CancellationToken ct)
    {
        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure(Error.NotFoundById("Product", cmd.Id));

        productRepo.Remove(product);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
