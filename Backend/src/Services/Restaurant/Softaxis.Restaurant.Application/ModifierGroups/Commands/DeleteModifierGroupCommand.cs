using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.ModifierGroups.Commands;

/// <summary>DELETE /api/restaurant/modifier-groups/{id}</summary>
public sealed record DeleteModifierGroupCommand(Guid Id) : ICommand;
