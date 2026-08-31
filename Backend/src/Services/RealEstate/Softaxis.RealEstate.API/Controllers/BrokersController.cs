using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Brokers.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/brokers")][Authorize]
public sealed class BrokersController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("real-estate.brokers.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBrokersSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("real-estate.brokers.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetBrokersQuery(), ct);
        return OkOrError(result);
    }
}
