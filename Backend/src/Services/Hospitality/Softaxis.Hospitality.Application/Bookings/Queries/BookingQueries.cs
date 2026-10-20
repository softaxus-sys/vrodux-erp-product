using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Hospitality.Application.Bookings.Dtos;

namespace Softaxis.Hospitality.Application.Bookings.Queries;

public sealed record GetBookingsSummaryQuery : IQuery<BookingsSummaryDto>;

// Every booking a property has ever taken, with no filter at all — it grows for as long as the
// hotel trades, so it pages in SQL. From/To filter on stays overlapping that window.
public sealed record GetBookingsQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30,
    string? From     = null,
    string? To       = null,
    Guid?   GuestId  = null) : IQuery<PagedResult<BookingDto>>;

public sealed record GetBookingByIdQuery(Guid Id) : IQuery<BookingDto>;

public sealed record GetBookingPaymentsQuery(Guid BookingId) : IQuery<IReadOnlyList<BookingPaymentDto>>;

public sealed record GetFolioQuery(Guid BookingId) : IQuery<FolioDto>;

public sealed record GetFrontDeskQuery(string? Today = null) : IQuery<FrontDeskDto>;
