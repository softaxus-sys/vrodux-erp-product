using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Categories.Commands.DeleteCategory;

public sealed class DeleteCategoryCommandHandler(
    ICategoryRepository  categoryRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<DeleteCategoryCommand>
{
    public async Task<Result> Handle(DeleteCategoryCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.Id, ct);
        if (category is null)
            return Result.Failure(Error.Custom("Category.NotFound", $"Category '{cmd.Id}' not found."));

        var hasProducts = await categoryRepo.HasProductsAsync(cmd.Id, ct);
        if (hasProducts)
            return Result.Failure(Error.Custom("Category.InUse", "Cannot delete a category that has associated products."));

        category.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
