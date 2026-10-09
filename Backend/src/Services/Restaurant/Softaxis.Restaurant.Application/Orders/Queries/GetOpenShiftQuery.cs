using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Orders.Queries;

/// <summary>GET /api/restaurant/orders/open-shift — whether a till shift is open for floor staff to
/// take orders under. Staff who do not run a till have no shift of their own to look at.</summary>
public sealed record GetOpenShiftQuery : IQuery<OpenShiftDto>;

public sealed record OpenShiftDto(bool IsOpen, Guid? SessionId);
