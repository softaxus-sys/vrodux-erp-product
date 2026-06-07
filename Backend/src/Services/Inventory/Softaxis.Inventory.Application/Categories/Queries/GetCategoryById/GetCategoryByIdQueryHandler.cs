using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Categories.Queries.GetCategoryById;

public sealed class GetCategoryByIdQueryHandler(ICategoryRepository categoryRepo)
    : IQueryHandler<GetCategoryByIdQuery, ProductCategoryDto>
{
    public async Task<Result<ProductCategoryDto>> Handle(GetCategoryByIdQuery query, CancellationToken ct)
    {
        var c = await categoryRepo.GetByIdAsync(query.Id, ct);
        if (c is null)
            return Result.Failure<ProductCategoryDto>(Error.Custom("Category.NotFound", $"Category '{query.Id}' not found."));

        return Result.Success(new ProductCategoryDto(
            c.Id, c.Name, c.Code, c.Description, c.ParentId, c.IsActive,
            c.Products.Count(p => !p.IsDeleted),
            c.CreatedAt, c.UpdatedAt));
    }
}
