using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.UserBranches.Dtos;

namespace Softaxis.Restaurant.Application.UserBranches.Queries;

/// <summary>GET /api/restaurant/user-branches?userId= — null UserId returns every assignment
/// (admin listing); a value filters to that user's rows. The controller's "mine" action always
/// passes the caller's own id, resolved server-side.</summary>
public sealed record GetUserBranchesQuery(Guid? UserId) : IQuery<IReadOnlyList<UserBranchDto>>;
