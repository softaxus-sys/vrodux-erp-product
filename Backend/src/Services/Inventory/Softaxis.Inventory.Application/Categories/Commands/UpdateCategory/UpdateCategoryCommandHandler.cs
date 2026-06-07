using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Categories.Commands.UpdateCategory;

public sealed class UpdateCategoryCommandHandler(
    ICategoryRepository  categoryRepo,
    IInventoryUnitOfWork uow)
    : ICommandHandler<UpdateCategoryCommand>
{
    public async Task<Result> Handle(UpdateCategoryCommand cmd, CancellationToken ct)
    {
        var category = await categoryRepo.GetByIdAsync(cmd.Id, ct);
        if (category is null)
            return Result.Failure(Error.Custom("Category.NotFound", $"Category '{cmd.Id}' not found."));

        category.Update(cmd.Name, cmd.Code, cmd.Description, cmd.ParentId, cmd.IsActive);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
