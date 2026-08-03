using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>DELETE /api/restaurant/menu/items/{id}</summary>
public sealed record DeleteMenuItemCommand(Guid Id) : ICommand;
