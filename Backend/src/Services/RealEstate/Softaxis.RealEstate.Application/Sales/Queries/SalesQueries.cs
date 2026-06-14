using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Sales.Dtos;

namespace Softaxis.RealEstate.Application.Sales.Queries;

public sealed record GetSalesSummaryQuery : IQuery<SalesSummaryDto>;

public sealed record GetSiteVisitsQuery(Guid? LeadId) : IQuery<IReadOnlyList<SiteVisitDto>>;

public sealed record GetReservationsQuery : IQuery<IReadOnlyList<ReservationDto>>;

public sealed record GetBookingsQuery : IQuery<IReadOnlyList<BookingDto>>;
