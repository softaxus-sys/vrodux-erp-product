using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Brands.Commands.CreateBrand;

public sealed record CreateBrandCommand(
    string  Name,
    string? Code,
    string? Description,
    string? LogoUrl
) : ICommand<BrandDto>;
