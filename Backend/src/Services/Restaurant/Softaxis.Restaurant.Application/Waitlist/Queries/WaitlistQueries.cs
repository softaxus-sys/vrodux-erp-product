using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Waitlist.Dtos;

namespace Softaxis.Restaurant.Application.Waitlist.Queries;

/// <summary>GET /api/restaurant/waitlist?status=</summary>
public sealed record GetWaitlistQuery(string? Status) : IQuery<IReadOnlyList<WaitlistEntryDto>>;

/// <summary>GET /api/restaurant/waitlist/summary</summary>
public sealed record GetWaitlistSummaryQuery : IQuery<WaitlistSummaryDto>;
