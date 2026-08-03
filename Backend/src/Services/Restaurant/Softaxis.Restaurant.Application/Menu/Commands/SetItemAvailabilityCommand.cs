using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>PATCH /api/restaurant/menu/items/{id}/availability</summary>
public sealed record SetItemAvailabilityCommand(
    Guid Id,
    bool IsAvailable
) : ICommand<ItemAvailabilityDto>;
