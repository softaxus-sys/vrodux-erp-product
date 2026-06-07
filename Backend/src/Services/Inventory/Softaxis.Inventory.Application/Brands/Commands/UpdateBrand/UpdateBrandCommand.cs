using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Brands.Commands.UpdateBrand;

public sealed record UpdateBrandCommand(
    Guid    Id,
    string  Name,
    string? Code,
    string? Description,
    string? LogoUrl,
    bool    IsActive
) : ICommand;
