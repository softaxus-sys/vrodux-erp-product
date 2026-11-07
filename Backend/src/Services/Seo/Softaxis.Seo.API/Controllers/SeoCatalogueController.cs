using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Catalogue;

namespace Softaxis.Seo.API.Controllers;

/// <summary>SEO for the workspace's own online-shop listings (Inventory). Saving writes to the listing, not to a script on a page.</summary>
[ApiController]
[Route("api/seo/catalogue")]
[Authorize]
public sealed class SeoCatalogueController(ISender sender) : SeoControllerBase
{
    [HttpGet]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Get(CancellationToken ct) => OkOrError(await sender.Send(new GetCatalogueSeoQuery(), ct));

    [HttpPost("{id:guid}/suggest")]
    [RequirePermission("seo.fixes.edit")]
    public async Task<IActionResult> Suggest(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new SuggestCatalogueSeoCommand(id), ct));

    public sealed record ApplyRequest(string? SeoTitle, string? MetaDescription);

    [HttpPost("{id:guid}/apply")]
    [RequirePermission("seo.fixes.edit")]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApplyCatalogueSeoCommand(id, r.SeoTitle, r.MetaDescription), ct));
}
