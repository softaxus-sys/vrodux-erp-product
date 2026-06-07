using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Brands.Commands.UpdateBrand;

public sealed class UpdateBrandCommandHandler(
    IBrandRepository     brandRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<UpdateBrandCommand>
{
    public async Task<Result> Handle(UpdateBrandCommand cmd, CancellationToken ct)
    {
        var brand = await brandRepo.GetByIdAsync(cmd.Id, ct);
        if (brand is null)
            return Result.Failure(Error.Custom("Brand.NotFound", $"Brand '{cmd.Id}' not found."));

        var nameExists = await brandRepo.ExistsByNameAsync(cmd.Name, cmd.Id, ct);
        if (nameExists)
            return Result.Failure(Error.Custom("Brand.Conflict", $"Brand '{cmd.Name}' already exists."));

        brand.Update(cmd.Name, cmd.Code, cmd.Description, cmd.LogoUrl, cmd.IsActive);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
