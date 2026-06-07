using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Categories.Commands.CreateCategory;

public sealed class CreateCategoryCommandHandler(
    IProductCategoryRepository categoryRepo,
    IUnitOfWork                uow)
    : ICommandHandler<CreateCategoryCommand, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(CreateCategoryCommand cmd, CancellationToken ct)
    {
        var nameExists = await categoryRepo.NameExistsAsync(cmd.Name, null, ct);
        if (nameExists)
            return Result.Failure<ProductCategoryDto>(Error.Custom("Category.NameTaken", $"Category '{cmd.Name}' already exists."));

        if (cmd.ParentCategoryId.HasValue)
        {
            var parent = await categoryRepo.GetByIdAsync(cmd.ParentCategoryId.Value, ct);
            if (parent is null)
                return Result.Failure<ProductCategoryDto>(Error.NotFoundById("ParentCategory", cmd.ParentCategoryId.Value));
        }

        var result = ProductCategory.Create(cmd.Name, cmd.Description, cmd.ParentCategoryId, cmd.SortOrder);
        if (result.IsFailure)
            return Result.Failure<ProductCategoryDto>(result.Error);

        categoryRepo.Add(result.Value);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new ProductCategoryDto(
            result.Value.Id, result.Value.Name, result.Value.Description,
            result.Value.ParentCategoryId, null, result.Value.SortOrder,
            result.Value.IsActive, 0));
    }
}
