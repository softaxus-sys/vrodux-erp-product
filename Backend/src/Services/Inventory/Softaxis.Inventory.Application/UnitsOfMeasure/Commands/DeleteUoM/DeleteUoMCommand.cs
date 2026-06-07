using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Commands.DeleteUoM;

public sealed record DeleteUoMCommand(Guid Id) : ICommand;
