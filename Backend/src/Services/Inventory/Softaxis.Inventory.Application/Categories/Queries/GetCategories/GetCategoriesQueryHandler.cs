using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Categories.Queries.GetCategories;

public sealed class GetCategoriesQueryHandler(ICategoryRepository categoryRepo)
    : IQueryHandler<GetCategoriesQuery, IReadOnlyList<ProductCategoryDto>>
{
    public async Task<Result<IReadOnlyList<ProductCategoryDto>>> Handle(GetCategoriesQuery query, CancellationToken ct)
    {
        // Lazy per-tenant seed: a new workspace starts with a usable starter set rather than an
        // empty list that blocks the product form until someone invents an entry by hand.
        await categoryRepo.EnsureDefaultsAsync(ct);

        var items = await categoryRepo.GetAllAsync(query.Search, query.IsActive, ct);

        var dtos = items.Select(c => new ProductCategoryDto(
            c.Id, c.Name, c.Code, c.Description, c.ParentId, c.IsActive,
            c.Products.Count(p => !p.IsDeleted),
            c.CreatedAt, c.UpdatedAt))
            .ToList();

        return Result.Success<IReadOnlyList<ProductCategoryDto>>(dtos);
    }
}
