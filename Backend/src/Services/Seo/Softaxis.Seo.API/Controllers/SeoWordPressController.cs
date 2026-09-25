using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Content.Commands;
using Softaxis.Seo.Application.Content.Queries;

namespace Softaxis.Seo.API.Controllers;

/// <summary>A site's optional WordPress push target. The application password is write-only from the
/// client's perspective — GetStatus never returns it, only whether a connection exists and is healthy.</summary>
[ApiController]
[Route("api/seo/sites/{siteId:guid}/wordpress")]
[Authorize]
public sealed class SeoWordPressController(ISender sender) : SeoControllerBase
{
    [HttpGet]
    [RequirePermission("seo.content.view")]
    public async Task<IActionResult> GetStatus(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWordPressStatusQuery(siteId), ct));

    public sealed record ConnectRequest(string SiteUrl, string Username, string AppPassword);

    [HttpPost]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Connect(Guid siteId, [FromBody] ConnectRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ConnectWordPressCommand(siteId, req.SiteUrl, req.Username, req.AppPassword), ct));

    [HttpDelete]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Disconnect(Guid siteId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectWordPressCommand(siteId), ct));

    public sealed record AutoPublishRequest(bool AutoPublish);

    [HttpPut("auto-publish")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> SetAutoPublish(Guid siteId, [FromBody] AutoPublishRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetWordPressAutoPublishCommand(siteId, req.AutoPublish), ct));
}
