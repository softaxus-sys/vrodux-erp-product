using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Brands.Queries.GetBrandById;

public sealed record GetBrandByIdQuery(Guid Id) : IQuery<BrandDto>;
