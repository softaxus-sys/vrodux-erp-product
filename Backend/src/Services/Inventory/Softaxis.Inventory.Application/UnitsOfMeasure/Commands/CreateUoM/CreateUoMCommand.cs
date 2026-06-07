using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.CreateUoM;

public sealed record CreateUoMCommand(
    string  Name,
    string  Symbol,
    string? Description
) : ICommand<UnitOfMeasureDto>;
