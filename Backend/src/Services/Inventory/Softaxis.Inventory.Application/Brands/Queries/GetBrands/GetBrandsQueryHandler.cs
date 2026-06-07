using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Brands.Queries.GetBrands;

public sealed class GetBrandsQueryHandler(IBrandRepository brandRepo)
    : IQueryHandler<GetBrandsQuery, IReadOnlyList<BrandDto>>
{
    public async Task<Result<IReadOnlyList<BrandDto>>> Handle(GetBrandsQuery query, CancellationToken ct)
    {
        var brands = await brandRepo.GetAllAsync(query.Search, query.IsActive, ct);
        var dtos = brands.Select(b => new BrandDto(
            b.Id, b.Name, b.Code, b.Description,
            b.LogoUrl, b.IsActive,
            b.Products.Count,
            b.CreatedAt, b.UpdatedAt)).ToList();

        return Result.Success<IReadOnlyList<BrandDto>>(dtos);
    }
}
