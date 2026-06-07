using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Categories.Commands.CreateCategory;

public sealed class CreateCategoryCommandHandler(
    ICategoryRepository  categoryRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<CreateCategoryCommand, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(CreateCategoryCommand cmd, CancellationToken ct)
    {
        var category = new ProductCategory(cmd.Name, cmd.Code, cmd.Description, cmd.ParentId);
        if (!cmd.IsActive) category.Update(cmd.Name, cmd.Code, cmd.Description, cmd.ParentId, false);

        categoryRepo.Add(category);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new ProductCategoryDto(
            category.Id, category.Name, category.Code, category.Description,
            category.ParentId, category.IsActive, 0, category.CreatedAt, category.UpdatedAt));
    }
}
