using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Brands.Commands.DeleteBrand;

public sealed record DeleteBrandCommand(Guid Id) : ICommand;
