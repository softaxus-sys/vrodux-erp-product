using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Brands.Queries.GetBrands;

public sealed record GetBrandsQuery(string? Search, bool? IsActive) : IQuery<IReadOnlyList<BrandDto>>;
