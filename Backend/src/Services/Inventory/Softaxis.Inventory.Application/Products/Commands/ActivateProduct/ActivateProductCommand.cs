using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Products.Commands.ActivateProduct;

public sealed record ActivateProductCommand(Guid Id) : ICommand;
