using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Listings.Commands;
using Softaxis.RealEstate.Application.Listings.Queries;
using Softaxis.RealEstate.Application.Units.Commands;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// The agency's stock list: one row per unit, with the building it sits in.
///
/// <para>A listing is a unit, so everything here is gated on the unit permissions. Creating one can
/// also create the building it names — the same arrangement as the rental-stock import, which has
/// always done both under units.create rather than demanding two keys for one action.</para>
/// </summary>
[ApiController][Route("api/real-estate/listings")][Authorize]
public sealed class ListingsController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetListingsSummaryQuery(), ct));

    /// <summary>
    /// The property types offered by the create form: the built-in defaults plus every type this
    /// workspace has already used.
    /// </summary>
    /// <remarks>
    /// Gated on units.view rather than properties.view. It feeds the listing form's type picker,
    /// and someone allowed to add a listing but not to browse the property register would
    /// otherwise open a form with an empty dropdown.
    /// </remarks>
    [HttpGet("property-types")]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetPropertyTypes(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPropertyTypesQuery(), ct));

    [HttpGet]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? purpose = null,
        [FromQuery] string? status = null,
        [FromQuery] string? propertyType = null,
        [FromQuery] string? category = null,
        [FromQuery] Guid? propertyId = null,
        [FromQuery] bool? advertised = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetListingsQuery(
            search, purpose, status, propertyType, category, propertyId, advertised, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("real-estate.units.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetListingByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("real-estate.units.create")]
    public async Task<IActionResult> Create([FromBody] CreateListingCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("real-estate.units.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateListingRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateListingCommand(
            id,
            req.PropertyName, req.PropertyType, req.Category, req.Address, req.City, req.Emirate,
            req.Developer, req.PropertyDescription, req.PropertyMarketValue,
            req.UnitNumber, req.UnitType, req.Area, req.Floor, req.RentPerYear, req.SalePrice,
            req.Status, req.Furnishing, req.View, req.Bedrooms, req.Bathrooms,
            req.Parking, req.ServiceCharge, req.Notes,
            req.Purpose, req.ListedOn, req.BedsLabel, req.PriceLabel, req.AreaLabel,
            req.HasMedia, req.IsListed, req.ListedBy, req.AgentName,
            req.AgentUserId, req.RestrictConfidentialDetails,
            req.OwnerName, req.OwnerPhone, req.OwnerPhoneAlt), ct));

    /// <summary>
    /// Removes the listing. It is the unit that goes, so this is the unit delete — including its
    /// refusal to remove anything with an active lease hanging off it.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("real-estate.units.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteUnitCommand(id), ct));

    /// <summary>
    /// The id is taken from the route, so it is absent here on purpose — a body carrying its own
    /// id lets the two disagree.
    /// </summary>
    public sealed record UpdateListingRequest(
        string? PropertyName, string? PropertyType, string? Category,
        string? Address, string? City, string? Emirate,
        string? Developer, string? PropertyDescription, decimal? PropertyMarketValue,
        string UnitNumber, string? UnitType, decimal Area, int Floor,
        decimal RentPerYear, decimal SalePrice, string? Status,
        string? Furnishing, string? View, int? Bedrooms, int? Bathrooms,
        int Parking, decimal ServiceCharge, string? Notes,
        string? Purpose, string? ListedOn, string? BedsLabel, string? PriceLabel, string? AreaLabel,
        bool HasMedia, bool IsListed, string? ListedBy, string? AgentName,
        Guid? AgentUserId, bool RestrictConfidentialDetails,
        string? OwnerName, string? OwnerPhone, string? OwnerPhoneAlt);
}
