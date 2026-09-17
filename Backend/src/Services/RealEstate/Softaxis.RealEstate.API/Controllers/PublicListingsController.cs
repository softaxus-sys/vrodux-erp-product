using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.PublicListings.Queries;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// Read-only listings for a tenant's public website.
///
/// Anonymous by design: the tenant is identified by the slug in the URL, never by a token — the
/// callers are ordinary visitors' browsers. This mirrors the public careers portal.
///
/// ⚠ Everything here is world-readable. The DTOs are a narrowed shape that deliberately omits
/// the owner's internal valuation and anything identifying a current occupant; do not widen them
/// to the internal PropertyDto for convenience.
/// </summary>
[ApiController]
[Route("api/real-estate/public/{tenantSlug}")]
[AllowAnonymous]
[EnableCors("PublicSite")]
public sealed class PublicListingsController(ISender sender) : RealEstateControllerBase
{
    /// <summary>Company name for the website header, and a cheap way to validate a slug.</summary>
    [HttpGet("company")]
    public async Task<IActionResult> GetCompany(string tenantSlug, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPublicCompanyQuery(tenantSlug), ct));

    [HttpGet("properties")]
    public async Task<IActionResult> GetProperties(
        string tenantSlug,
        [FromQuery] string? search = null,
        [FromQuery] string? propertyType = null,
        [FromQuery] string? emirate = null,
        [FromQuery] string? city = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(
            new GetPublicPropertiesQuery(tenantSlug, search, propertyType, emirate, city, page, pageSize), ct));

    [HttpGet("properties/{id:guid}")]
    public async Task<IActionResult> GetProperty(string tenantSlug, Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPublicPropertyQuery(tenantSlug, id), ct));

    /// <summary>
    /// One photo of a published property.
    ///
    /// Cached hard and publicly: an image's bytes never change (editing means uploading a new
    /// one), and unlike the authenticated equivalent these are genuinely public, so a CDN or the
    /// visitor's browser may keep them. Withdrawing a property from the website stops new
    /// requests succeeding, but anything already cached stays cached for its lifetime — which is
    /// the normal trade for public images, and worth knowing before publishing anything
    /// sensitive.
    /// </summary>
    [HttpGet("properties/{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> GetImage(
        string tenantSlug, Guid id, Guid imageId, CancellationToken ct)
    {
        var result = await sender.Send(new GetPublicPropertyImageQuery(tenantSlug, id, imageId), ct);
        if (!result.IsSuccess) return OkOrError(result);

        Response.Headers.CacheControl = "public, max-age=604800, immutable";
        return File(result.Value.Data, result.Value.ContentType);
    }
}
