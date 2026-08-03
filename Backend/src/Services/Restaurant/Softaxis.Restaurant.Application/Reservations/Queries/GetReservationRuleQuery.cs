using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Queries;

/// <summary>GET /api/restaurant/reservations/rules?branchId= — null if no rule configured yet
/// (auto-no-show is opt-in, not a silent default).</summary>
public sealed record GetReservationRuleQuery(Guid? BranchId) : IQuery<ReservationRuleDto?>;
