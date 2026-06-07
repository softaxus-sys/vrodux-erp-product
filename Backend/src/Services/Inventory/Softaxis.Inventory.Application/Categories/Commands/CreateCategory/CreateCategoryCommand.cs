using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Categories.Commands.CreateCategory;

public sealed record CreateCategoryCommand(
    string  Name,
    string? Code,
    string? Description,
    string? ParentId,
    bool    IsActive = true
) : ICommand<ProductCategoryDto>;
