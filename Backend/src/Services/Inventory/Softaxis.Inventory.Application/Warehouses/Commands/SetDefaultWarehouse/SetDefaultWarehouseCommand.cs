using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Warehouses.Commands.SetDefaultWarehouse;

public sealed record SetDefaultWarehouseCommand(Guid Id) : ICommand;
