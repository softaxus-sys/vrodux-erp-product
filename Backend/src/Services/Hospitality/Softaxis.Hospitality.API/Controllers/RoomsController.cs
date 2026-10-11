using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Rooms.Queries;
using Softaxis.Hospitality.API.Authorization;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/rooms")][Authorize]
public sealed class RoomsController(ISender sender) : HospitalityControllerBase
{
    [RequirePermission("hospitality.rooms.view")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetRoomsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [RequirePermission("hospitality.rooms.view", "hospitality.bookings.create")]
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetRoomsQuery(), ct);
        return OkOrError(result);
    }
}
