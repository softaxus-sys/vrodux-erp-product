using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.UserBranches.Commands;
using Softaxis.Restaurant.Application.UserBranches.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Branch-scoping assignments (Epic 9) — "mine" is self-service (any authenticated user reads
/// their own assignments, needed for the branch switcher to work for every cashier/waiter, not just
/// admins). Admin listing/create/edit/remove is gated on restaurant.branches.*.</summary>
[ApiController][Route("api/restaurant/user-branches")][Authorize]
public sealed class UserBranchesController(ISender sender, ICurrentUser currentUser) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/user-branches/mine — the caller's own branch assignments.</summary>
    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        if (currentUser.Id is null) return Unauthorized();
        return OkOrError(await sender.Send(new GetUserBranchesQuery(currentUser.Id), ct));
    }

    /// <summary>GET /api/restaurant/user-branches?userId= — admin listing (all, or filtered).</summary>
    [HttpGet]
    [RequirePermission("restaurant.branches.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? userId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetUserBranchesQuery(userId), ct));

    /// <summary>POST /api/restaurant/user-branches — assigns a user to a branch.</summary>
    [HttpPost]
    [RequirePermission("restaurant.branches.edit")]
    public async Task<IActionResult> Add([FromBody] AddUserBranchCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PUT /api/restaurant/user-branches/{id} — changes the assignment's role.</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.branches.edit")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] RoleReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateUserBranchRoleCommand(id, req.Role), ct));

    /// <summary>DELETE /api/restaurant/user-branches/{id} — removes the assignment.</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.branches.edit")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new RemoveUserBranchCommand(id), ct));

    public sealed record RoleReq(string Role);
}
