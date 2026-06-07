using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Categories.Queries.GetCategories;

public sealed class GetCategoriesQueryHandler(IProductCategoryRepository categoryRepo)
    : IQueryHandler<GetCategoriesQuery, PagedResult<ProductCategoryDto>>
{
    public async Task<Result<PagedResult<ProductCategoryDto>>> Handle(GetCategoriesQuery query, CancellationToken ct)
    {
        var paged = await categoryRepo.GetPagedAsync(query.Page, query.PageSize, query.Search, ct);

        var dtos = paged.Items
            .Where(c => query.IsActive == null || c.IsActive == query.IsActive)
            .Select(c => new ProductCategoryDto(
                c.Id, c.Name, c.Description,
                c.ParentCategoryId, c.ParentCategory?.Name,
                c.SortOrder, c.IsActive, c.Products.Count))
            .ToList();

        return Result.Success(PagedResult<ProductCategoryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
