using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/properties")][Authorize]
public sealed class PropertiesController(ISender sender) : RealEstateControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("real-estate.properties.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertiesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("real-estate.properties.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? propertyType = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetPropertiesQuery(search, status, propertyType, page, pageSize), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("real-estate.properties.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertyByIdQuery(id), ct);
        return OkOrError(result);
    }

    /// <summary>Bulk import from a spreadsheet. Gated on create — it creates properties.</summary>
    [HttpPost("import")]
    [RequirePermission("real-estate.properties.create")]
    public async Task<IActionResult> Import([FromBody] ImportPropertiesCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPost]
    [RequirePermission("real-estate.properties.create")]
    public async Task<IActionResult> Create([FromBody] CreatePropertyCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePropertyRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdatePropertyCommand(id, req.Name, req.PropertyType, req.Address,
            req.City, req.Emirate, req.TotalArea, req.TotalUnits, req.MarketValue, req.Developer, req.Description,
            req.ListOnWebsite), ct);
        return OkOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("real-estate.properties.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeletePropertyCommand(id), ct);
        return NoContentOrError(result);
    }

    // ---- Photographs -------------------------------------------------------------------

    /// <summary>
    /// Serves one image's bytes.
    ///
    /// A dedicated endpoint rather than base64 in the property JSON: the browser then caches each
    /// photo independently and a property with a full gallery costs one small JSON response plus
    /// however many images are actually on screen.
    /// </summary>
    [HttpGet("{id:guid}/images/{imageId:guid}")]
    [RequirePermission("real-estate.properties.view")]
    public async Task<IActionResult> GetImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var result = await sender.Send(new GetPropertyImageQuery(id, imageId), ct);
        if (!result.IsSuccess) return OkOrError(result);

        // Immutable: an image's bytes never change — editing means uploading a new one — so it
        // can be cached hard. Private, because these are behind a permission check.
        Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        return File(result.Value.Data, result.Value.ContentType);
    }

    [HttpPost("{id:guid}/images")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> AddImages(Guid id, [FromBody] AddImagesRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddPropertyImagesCommand(id, req.Images), ct));

    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePropertyImageCommand(id, imageId), ct));

    [HttpPatch("{id:guid}/images/{imageId:guid}/primary")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> SetPrimaryImage(Guid id, Guid imageId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetPrimaryPropertyImageCommand(id, imageId), ct));

    [HttpPatch("{id:guid}/images/order")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> ReorderImages(Guid id, [FromBody] ReorderImagesRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new ReorderPropertyImagesCommand(id, req.OrderedIds), ct));

    // ---- Website listing ---------------------------------------------------------------

    /// <summary>
    /// Publishes or withdraws a property from the public website.
    ///
    /// Gated on edit rather than a new permission: anyone trusted to change a property's details
    /// is trusted to decide whether it is marketed. A separate key would need a migration and a
    /// grant on every existing role before this button worked for anyone.
    /// </summary>
    [HttpPatch("{id:guid}/website-listing")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> SetWebsiteListing(
        Guid id, [FromBody] SetWebsiteListingRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetPropertyWebsiteListingCommand(id, req.ListOnWebsite), ct));

    public sealed record UpdatePropertyRequest(
        string Name, string PropertyType, string? Address, string? City, string Emirate,
        decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description,
        // Nullable: omitting it leaves the current setting alone. A plain bool would unpublish
        // every property saved from a form that does not send the field.
        bool? ListOnWebsite = null);

    public sealed record SetWebsiteListingRequest(bool ListOnWebsite);
    public sealed record AddImagesRequest(IReadOnlyList<PropertyImageInput> Images);
    public sealed record ReorderImagesRequest(IReadOnlyList<Guid> OrderedIds);
}
