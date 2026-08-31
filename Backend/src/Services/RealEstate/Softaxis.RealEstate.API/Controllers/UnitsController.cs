using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Units.Commands;
using Softaxis.RealEstate.Application.Units.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/units")][Authorize]
public sealed class UnitsController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetUnitsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? propertyId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetUnitsQuery(propertyId, search, status, page, pageSize), ct);
        return OkOrError(result);
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    // This controller was read-only, so the frontend's createUnit/deleteUnit called endpoints that
    // did not exist and Add Unit silently did nothing.

    public sealed record UpsertUnitRequest(
        Guid PropertyId, string UnitNumber, string UnitType,
        decimal Area, int Floor, decimal RentPerYear, decimal SalePrice,
        string? Furnishing = null, string? View = null, int? Bedrooms = null, int? Bathrooms = null,
        int Parking = 0, decimal ServiceCharge = 0, string? Notes = null);

    [HttpPost]
    [RequirePermission("real-estate.units.create")]
    public async Task<IActionResult> Create([FromBody] UpsertUnitRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateUnitCommand(
            req.PropertyId, req.UnitNumber, req.UnitType,
            req.Area, req.Floor, req.RentPerYear, req.SalePrice,
            req.Furnishing, req.View, req.Bedrooms, req.Bathrooms,
            req.Parking, req.ServiceCharge, req.Notes), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("real-estate.units.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertUnitRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdateUnitCommand(
            id, req.UnitNumber, req.UnitType,
            req.Area, req.Floor, req.RentPerYear, req.SalePrice,
            req.Furnishing, req.View, req.Bedrooms, req.Bathrooms,
            req.Parking, req.ServiceCharge, req.Notes), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("real-estate.units.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteUnitCommand(id), ct));
}
