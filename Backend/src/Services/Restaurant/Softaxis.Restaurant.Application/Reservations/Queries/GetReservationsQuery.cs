using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Queries;

/// <summary>GET /api/restaurant/reservations?date=yyyy-MM-dd</summary>
public sealed record GetReservationsQuery(string? Date) : IQuery<IReadOnlyList<ReservationDto>>;
