using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Tenants.Commands;
using Softaxis.RealEstate.Application.Tenants.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/tenants")][Authorize]
public sealed class TenantsController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("real-estate.tenants.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetTenantsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("real-estate.tenants.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetTenantsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("real-estate.tenants.create")]
    public async Task<IActionResult> Create([FromBody] CreateTenantCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("real-estate.tenants.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteTenantCommand(id), ct);
        return NoContentOrError(result);
    }
}
