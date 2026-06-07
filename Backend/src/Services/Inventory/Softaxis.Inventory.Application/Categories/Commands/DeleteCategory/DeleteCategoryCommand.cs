using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Categories.Commands.DeleteCategory;

public sealed record DeleteCategoryCommand(Guid Id) : ICommand;
