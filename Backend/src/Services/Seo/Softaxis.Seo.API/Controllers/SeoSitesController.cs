using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Sites.Commands;
using Softaxis.Seo.Application.Sites.Dtos;
using Softaxis.Seo.Application.Sites.Queries;

namespace Softaxis.Seo.API.Controllers;

[ApiController]
[Route("api/seo/sites")]
[Authorize]
public sealed class SeoSitesController(ISender sender) : SeoControllerBase
{
    [HttpGet]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSitesQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSiteByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("seo.sites.create")]
    public async Task<IActionResult> Create([FromBody] CreateSiteRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateSiteCommand(req.Domain, req.DisplayName, req.ScanFrequency), ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? result.Value.Id : Guid.Empty });
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSiteRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateSiteCommand(id, req.DisplayName, req.ScanFrequency), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("seo.sites.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteSiteCommand(id), ct));

    [HttpPost("{id:guid}/rotate-snippet-key")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> RotateSnippetKey(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RotateSnippetKeyCommand(id), ct));
}
