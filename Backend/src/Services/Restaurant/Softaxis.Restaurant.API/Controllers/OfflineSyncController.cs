using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Offline;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Upload of a restaurant till's offline queue — see <see cref="SyncOfflineOpsCommand"/>.</summary>
[ApiController][Route("api/restaurant/offline")][Authorize]
public sealed class OfflineSyncController(ISender sender) : RestaurantControllerBase
{
    /// <summary>POST /api/restaurant/offline/sync</summary>
    [HttpPost("sync")]
    [RequirePermission("restaurant.orders.create")]
    public async Task<IActionResult> Sync([FromBody] SyncOfflineOpsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
