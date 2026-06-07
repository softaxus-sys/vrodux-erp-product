using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Categories.Queries.GetCategories;

public sealed record GetCategoriesQuery(
    int     Page     = 1,
    int     PageSize = 50,
    string? Search   = null,
    bool?   IsActive = null)
    : IQuery<PagedResult<ProductCategoryDto>>;
