using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Units.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/units")][Authorize]
public sealed class UnitsController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetUnitsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? propertyId, CancellationToken ct)
    {
        var result = await sender.Send(new GetUnitsQuery(propertyId), ct);
        return OkOrError(result);
    }
}
