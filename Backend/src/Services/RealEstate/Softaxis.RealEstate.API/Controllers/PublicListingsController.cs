using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.API.Extensions;
using Softaxis.RealEstate.Application.PublicListings.Queries;
using Softaxis.RealEstate.Application.WebsiteIntegrations;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// Read-only listings for a workspace's own website.
///
/// Requires the website API key (<c>X-Api-Key</c>) generated under Real Estate → Website. The key
/// decides the workspace — nothing in the URL does — and is locked to one website address; see
/// <see cref="WebsiteApiKeyAttribute"/>.
///
/// ⚠ The DTOs are a narrowed shape that deliberately omits the owner's internal valuation and
/// anything identifying a current occupant; do not widen them to the internal PropertyDto.
/// </summary>
[ApiController]
[Route("api/real-estate/website")]
[AllowAnonymous]
[EnableCors("PublicSite")]
[EnableRateLimiting(WebsiteRateLimitPolicies.WebsiteApi)]
public sealed class PublicListingsController(ISender sender) : RealEstateControllerBase
{
    private WebsiteClientDto Client => (WebsiteClientDto)HttpContext.Items[WebsiteApiKeyAttribute.ClientItemKey]!;

    /// <summary>Company name for the website header — and a cheap way for a site to test its key.</summary>
    [HttpGet("company")]
    [WebsiteApiKey]
    public IActionResult GetCompany() => Ok(new { Name = Client.TenantName });

    [HttpGet("properties")]
    [WebsiteApiKey]
    public async Task<IActionResult> GetProperties(
        [FromQuery] string? search = null,
        [FromQuery] string? propertyType = null,
        [FromQuery] string? emirate = null,
        [FromQuery] string? city = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(
            new GetPublicPropertiesQuery(Client, search, propertyType, emirate, city, page, pageSize), ct));

    [HttpGet("properties/{id:guid}")]
    [WebsiteApiKey]
    public async Task<IActionResult> GetProperty(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPublicPropertyQuery(Client, id), ct));

    /// <summary>
    /// One photo, by the signed URL returned in a listing. No API key: browsers cannot send one
    /// with an image request, and the key must never reach a browser. The signature expires, is
    /// bound to the property and image, and dies with a regenerated key.
    /// </summary>
    [HttpGet("images/{integrationId:guid}/{propertyId:guid}/{imageId:guid}")]
    public async Task<IActionResult> GetImage(
        Guid integrationId, Guid propertyId, Guid imageId,
        [FromQuery] long exp, [FromQuery] string? sig, CancellationToken ct)
    {
        var result = await sender.Send(
            new GetPublicPropertyImageQuery(integrationId, propertyId, imageId, exp, sig ?? ""), ct);
        if (!result.IsSuccess) return OkOrError(result);

        // Private: a shared cache would keep serving a withdrawn property's photo.
        Response.Headers.CacheControl = "private, max-age=3600";
        return File(result.Value.Data, result.Value.ContentType);
    }
}
