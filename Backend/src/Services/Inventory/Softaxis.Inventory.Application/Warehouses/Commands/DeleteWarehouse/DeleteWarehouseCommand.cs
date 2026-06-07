using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Warehouses.Commands.DeleteWarehouse;

public sealed record DeleteWarehouseCommand(Guid Id) : ICommand;
