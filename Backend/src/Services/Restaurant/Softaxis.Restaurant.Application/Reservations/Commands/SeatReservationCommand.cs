using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Commands;

/// <summary>PATCH /api/restaurant/reservations/{id}/seat</summary>
public sealed record SeatReservationCommand(Guid Id) : ICommand<ReservationStatusDto>;

/// <summary>PATCH /api/restaurant/reservations/{id}/cancel</summary>
public sealed record CancelReservationCommand(Guid Id) : ICommand<ReservationStatusDto>;
