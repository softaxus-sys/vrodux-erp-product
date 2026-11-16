using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Profile;

namespace Softaxis.Seo.API.Controllers;

/// <summary>What the business behind a website does. Competitor plans and scheduled articles are judged against it so they stay on topic.</summary>
[ApiController]
[Route("api/seo/sites/{siteId:guid}")]
[Authorize]
public sealed class SeoProfileController(ISender sender) : SeoControllerBase
{
    [HttpGet("business-profile")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Get(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new GetBusinessProfileQuery(siteId), ct));

    public sealed record SaveRequest(
        string BusinessName, string? Industry, string Summary, List<string>? Offers, string? Audience, string? ServiceAreas,
        List<string>? AvoidTopics, string? Source);

    [HttpPut("business-profile")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Save(Guid siteId, [FromBody] SaveRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveBusinessProfileCommand(siteId, r.BusinessName, r.Industry, r.Summary, r.Offers, r.Audience, r.ServiceAreas, r.AvoidTopics, r.Source), ct));

    [HttpGet("business-profile/tenant-preview")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> TenantPreview(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new GetTenantProfilePreviewQuery(siteId), ct));

    public sealed record ImportRequest(bool Overwrite);

    [HttpPost("business-profile/import-from-tenant")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Import(Guid siteId, [FromBody] ImportRequest? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ImportBusinessProfileFromTenantCommand(siteId, r?.Overwrite ?? false), ct));

    [HttpPost("business-profile/draft-from-website")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> DraftFromWebsite(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new DraftBusinessProfileFromSiteCommand(siteId), ct));

    [HttpPost("business-profile/autofill")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Autofill(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new RequestProfileAutofillCommand(siteId), ct));

    public sealed record SuggestRequest(int? LocationCode);

    [HttpPost("competitor-suggestions")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> SuggestCompetitors(Guid siteId, [FromBody] SuggestRequest? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SuggestCompetitorsCommand(siteId, r?.LocationCode), ct));
}
