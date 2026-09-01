using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Hospitality.Application.Bookings.Dtos;

namespace Softaxis.Hospitality.Application.Bookings.Queries;

public sealed record GetBookingsSummaryQuery : IQuery<BookingsSummaryDto>;

// Every booking a property has ever taken, with no filter at all — it grows for as long as the
// hotel trades, so it pages in SQL.
public sealed record GetBookingsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<BookingDto>>;
