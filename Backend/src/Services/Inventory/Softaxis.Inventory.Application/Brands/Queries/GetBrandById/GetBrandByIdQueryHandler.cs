using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.Brands.Queries.GetBrandById;

public sealed class GetBrandByIdQueryHandler(IBrandRepository brandRepo)
    : IQueryHandler<GetBrandByIdQuery, BrandDto>
{
    public async Task<Result<BrandDto>> Handle(GetBrandByIdQuery query, CancellationToken ct)
    {
        var b = await brandRepo.GetByIdAsync(query.Id, ct);
        if (b is null)
            return Result.Failure<BrandDto>(Error.Custom("Brand.NotFound", $"Brand '{query.Id}' not found."));

        return Result.Success(new BrandDto(
            b.Id, b.Name, b.Code, b.Description,
            b.LogoUrl, b.IsActive,
            b.Products.Count,
            b.CreatedAt, b.UpdatedAt));
    }
}
