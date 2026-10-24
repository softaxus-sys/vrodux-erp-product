using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Kitchen.Dtos;

namespace Softaxis.Restaurant.Application.Kitchen.Queries;

/// <summary>GET /api/restaurant/kitchen/summary</summary>
public sealed record GetKitchenSummaryQuery(Guid? BranchId = null) : IQuery<KitchenSummaryDto>;
