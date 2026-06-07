using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Categories.Commands.UpdateCategory;

public sealed record UpdateCategoryCommand(
    Guid    Id,
    string  Name,
    string? Code,
    string? Description,
    string? ParentId,
    bool    IsActive
) : ICommand;
