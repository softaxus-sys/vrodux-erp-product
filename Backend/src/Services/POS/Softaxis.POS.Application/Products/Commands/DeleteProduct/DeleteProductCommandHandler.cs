using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Products.Commands.DeleteProduct;

public sealed class DeleteProductCommandHandler(
    IProductRepository productRepo,
    IUnitOfWork        uow,
    ICatalogueGateway  catalogue)
    : ICommandHandler<DeleteProductCommand>
{
    public async Task<Result> Handle(DeleteProductCommand cmd, CancellationToken ct)
    {
        if (await catalogue.UsesInventoryAsync(ct)) return await catalogue.DeleteAsync(cmd.Id, ct);

        var product = await productRepo.GetByIdAsync(cmd.Id, ct);
        if (product is null)
            return Result.Failure(Error.NotFoundById("Product", cmd.Id));

        productRepo.Remove(product);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
