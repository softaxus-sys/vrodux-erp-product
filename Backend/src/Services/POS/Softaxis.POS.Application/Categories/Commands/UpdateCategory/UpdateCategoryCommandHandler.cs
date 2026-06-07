using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Categories.Commands.UpdateCategory;

public sealed class UpdateCategoryCommandHandler(
    IProductCategoryRepository categoryRepo,
    IUnitOfWork                uow)
    : ICommandHandler<UpdateCategoryCommand, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(UpdateCategoryCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.Id, ct);
        if (category is null)
            return Result.Failure<ProductCategoryDto>(Error.NotFoundById("Category", cmd.Id));

        var nameExists = await categoryRepo.NameExistsAsync(cmd.Name, cmd.Id, ct);
        if (nameExists)
            return Result.Failure<ProductCategoryDto>(Error.Custom("Category.NameTaken", $"Category name '{cmd.Name}' is already in use."));

        // Prevent circular reference
        if (cmd.ParentCategoryId == cmd.Id)
            return Result.Failure<ProductCategoryDto>(Error.Custom("Category.CircularRef", "A category cannot be its own parent."));

        var updateResult = category.Update(cmd.Name, cmd.Description, cmd.ParentCategoryId, cmd.SortOrder);
        if (updateResult.IsFailure)
            return Result.Failure<ProductCategoryDto>(updateResult.Error);

        if (cmd.IsActive) category.Activate(); else category.Deactivate();

        categoryRepo.Update(category);
        await uow.SaveChangesAsync(ct);

        string? parentName = null;
        if (category.ParentCategoryId.HasValue)
        {
            var parent = await categoryRepo.GetByIdAsync(category.ParentCategoryId.Value, ct);
            parentName = parent?.Name;
        }

        return Result.Success(new ProductCategoryDto(
            category.Id, category.Name, category.Description,
            category.ParentCategoryId, parentName,
            category.SortOrder, category.IsActive,
            category.Products.Count));
    }
}
