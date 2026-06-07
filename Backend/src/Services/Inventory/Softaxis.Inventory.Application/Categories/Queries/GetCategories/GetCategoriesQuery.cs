using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Categories.Queries.GetCategories;

public sealed record GetCategoriesQuery(
    string? Search   = null,
    bool?   IsActive = null
) : IQuery<IReadOnlyList<ProductCategoryDto>>;
