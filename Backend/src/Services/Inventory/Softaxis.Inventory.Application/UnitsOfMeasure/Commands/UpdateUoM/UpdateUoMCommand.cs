using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.UpdateUoM;

public sealed record UpdateUoMCommand(
    Guid    Id,
    string  Name,
    string  Symbol,
    string? Description,
    bool    IsActive
) : ICommand;
