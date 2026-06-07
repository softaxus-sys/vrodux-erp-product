using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Categories.Commands.DeleteCategory;

public sealed class DeleteCategoryCommandHandler(
    IProductCategoryRepository categoryRepo,
    IUnitOfWork                uow)
    : ICommandHandler<DeleteCategoryCommand>
{
    public async Task<Result> Handle(DeleteCategoryCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.Id, ct);
        if (category is null)
            return Result.Failure(Error.NotFoundById("Category", cmd.Id));

        if (category.Products.Count > 0)
            return Result.Failure(Error.Custom("Category.InUse",
                "Cannot delete a category that has products assigned to it."));

        if (category.SubCategories.Count > 0)
            return Result.Failure(Error.Custom("Category.HasChildren",
                "Cannot delete a category that has sub-categories."));

        categoryRepo.Remove(category);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
