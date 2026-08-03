using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Queries;

/// <summary>GET /api/restaurant/reservations/summary</summary>
public sealed record GetReservationsSummaryQuery : IQuery<ReservationsSummaryDto>;
