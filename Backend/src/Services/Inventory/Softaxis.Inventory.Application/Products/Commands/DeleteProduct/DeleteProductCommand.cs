using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Products.Commands.DeleteProduct;

public sealed record DeleteProductCommand(Guid Id) : ICommand;
