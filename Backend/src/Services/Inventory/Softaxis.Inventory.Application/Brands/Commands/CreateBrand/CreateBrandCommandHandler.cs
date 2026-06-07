using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Brands.Commands.CreateBrand;

public sealed class CreateBrandCommandHandler(
    IBrandRepository     brandRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<CreateBrandCommand, BrandDto>
{
    public async Task<Result<BrandDto>> Handle(CreateBrandCommand cmd, CancellationToken ct)
    {
        var nameExists = await brandRepo.ExistsByNameAsync(cmd.Name, null, ct);
        if (nameExists)
            return Result.Failure<BrandDto>(Error.Custom("Brand.Conflict", $"Brand '{cmd.Name}' already exists."));

        var brand = new Brand(cmd.Name, cmd.Code, cmd.Description, cmd.LogoUrl);
        brandRepo.Add(brand);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new BrandDto(
            brand.Id, brand.Name, brand.Code, brand.Description,
            brand.LogoUrl, brand.IsActive, 0, brand.CreatedAt, brand.UpdatedAt));
    }
}
