using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Brands.Commands.DeleteBrand;

public sealed class DeleteBrandCommandHandler(
    IBrandRepository     brandRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<DeleteBrandCommand>
{
    public async Task<Result> Handle(DeleteBrandCommand cmd, CancellationToken ct)
    {
        var brand = await brandRepo.GetByIdAsync(cmd.Id, ct);
        if (brand is null)
            return Result.Failure(Error.Custom("Brand.NotFound", $"Brand '{cmd.Id}' not found."));

        var hasProducts = await brandRepo.HasProductsAsync(cmd.Id, ct);
        if (hasProducts)
            return Result.Failure(Error.Custom("Brand.InUse", "Cannot delete a brand that has products assigned to it."));

        brand.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
