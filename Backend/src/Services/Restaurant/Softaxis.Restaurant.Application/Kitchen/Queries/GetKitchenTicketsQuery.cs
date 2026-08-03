using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Kitchen.Dtos;

namespace Softaxis.Restaurant.Application.Kitchen.Queries;

/// <summary>GET /api/restaurant/kitchen/tickets?stationId= — when stationId is set, only items routed
/// to that station are returned (tickets left with zero matching items are dropped entirely). Items
/// not yet fired (CourseNumber &gt; the order's CurrentCourse) are always excluded.</summary>
public sealed record GetKitchenTicketsQuery(Guid? StationId = null) : IQuery<IReadOnlyList<KitchenTicketDto>>;
