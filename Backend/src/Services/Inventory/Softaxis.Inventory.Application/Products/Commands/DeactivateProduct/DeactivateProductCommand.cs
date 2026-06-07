using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Products.Commands.DeactivateProduct;

public sealed record DeactivateProductCommand(Guid Id) : ICommand;
