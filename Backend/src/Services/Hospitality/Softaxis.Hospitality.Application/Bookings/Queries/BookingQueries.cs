using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Bookings.Dtos;

namespace Softaxis.Hospitality.Application.Bookings.Queries;

public sealed record GetBookingsSummaryQuery : IQuery<BookingsSummaryDto>;

public sealed record GetBookingsQuery : IQuery<IReadOnlyList<BookingDto>>;
