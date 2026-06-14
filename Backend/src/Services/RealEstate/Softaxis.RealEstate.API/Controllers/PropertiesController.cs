using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/properties")][Authorize]
public sealed class PropertiesController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertiesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertiesQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertyByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePropertyCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePropertyRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePropertyCommand(id, req.Name, req.PropertyType, req.Address,
            req.City, req.Emirate, req.TotalArea, req.TotalUnits, req.MarketValue, req.Developer, req.Description), ct);
        return OkOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePropertyCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdatePropertyRequest(
        string Name, string PropertyType, string? Address, string? City, string Emirate,
        decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description);
}
