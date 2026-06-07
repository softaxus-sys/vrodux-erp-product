using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;

public sealed record CreateStockMovementCommand(
    Guid      ProductId,
    string    MovementType,
    decimal   Quantity,
    decimal   UnitCost,
    string?   Reference,
    string?   Notes,
    Guid?     WarehouseId,
    string?   BatchNumber = null,
    DateTime? ExpiryDate  = null
) : ICommand<Guid>;
