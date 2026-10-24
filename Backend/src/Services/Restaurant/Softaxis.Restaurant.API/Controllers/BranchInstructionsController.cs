using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.BranchInstructions;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>
/// Head office's way to change a bill that lives on a branch's own server: it asks, the branch applies it.
/// See docs/branch-server-design.md §7. The needed permission (void or refund) is checked in the handler,
/// because it depends on the kind of request.
/// </summary>
[ApiController][Route("api/restaurant/branch-instructions")][Authorize]
public sealed class BranchInstructionsController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/branch-instructions?branchId=&orderId=</summary>
    [HttpGet]
    [RequirePermission("restaurant.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? branchId, [FromQuery] Guid? orderId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBranchInstructionsQuery(branchId, orderId), ct));

    /// <summary>POST /api/restaurant/branch-instructions</summary>
    [HttpPost]
    [RequirePermission("restaurant.orders.view")]   // void / refund permission is checked in the handler
    public async Task<IActionResult> Create([FromBody] CreateBranchInstructionCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
