using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Warehouses.Commands.UpdateWarehouse;

public sealed record UpdateWarehouseCommand(
    Guid    Id,
    string  Name,
    string? Code,
    string? Address,
    string? ContactPerson,
    string? Phone,
    bool    IsActive
) : ICommand;
