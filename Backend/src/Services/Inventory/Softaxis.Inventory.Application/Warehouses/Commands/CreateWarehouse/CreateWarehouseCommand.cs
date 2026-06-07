using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Warehouses.Commands.CreateWarehouse;

public sealed record CreateWarehouseCommand(
    string  Name,
    string? Code,
    string? Address,
    string? ContactPerson,
    string? Phone,
    bool    IsActive = true
) : ICommand<WarehouseDto>;
