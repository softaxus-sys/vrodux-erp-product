using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Content.Commands;
using Softaxis.Seo.Application.Content.Queries;

namespace Softaxis.Seo.API.Controllers;

/// <summary>Scheduled AI content — settings, the review queue, and manual "generate now". Separate
/// permission group (seo.content) from seo.sites/seo.fixes: writing articles is its own review
/// surface, not the technical-fix one.</summary>
[ApiController]
[Route("api/seo")]
[Authorize]
public sealed class SeoContentController(ISender sender) : SeoControllerBase
{
    [HttpGet("sites/{siteId:guid}/content-settings")]
    [RequirePermission("seo.content.view")]
    public async Task<IActionResult> GetSettings(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetContentSettingsQuery(siteId), ct));

    public sealed record UpdateSettingsRequest(bool Enabled, string Frequency, int ArticlesPerRun, int TargetWordCount, string? NicheHint, string? CompetitorDomainsCsv);

    [HttpPut("sites/{siteId:guid}/content-settings")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> UpdateSettings(Guid siteId, [FromBody] UpdateSettingsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateContentSettingsCommand(
            siteId, req.Enabled, req.Frequency, req.ArticlesPerRun, req.TargetWordCount, req.NicheHint, req.CompetitorDomainsCsv), ct));

    [HttpGet("sites/{siteId:guid}/articles")]
    [RequirePermission("seo.content.view")]
    public async Task<IActionResult> GetArticles(Guid siteId, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetArticlesQuery(siteId, status), ct));

    [HttpGet("articles/{id:guid}")]
    [RequirePermission("seo.content.view")]
    public async Task<IActionResult> GetArticle(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetArticleByIdQuery(id), ct));

    [HttpPost("sites/{siteId:guid}/articles/generate")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> GenerateNow(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GenerateArticleNowCommand(siteId), ct));

    [HttpPost("articles/{id:guid}/approve")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApproveArticleCommand(id), ct));

    [HttpPost("articles/{id:guid}/reject")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RejectArticleCommand(id), ct));

    [HttpPost("articles/{id:guid}/push-wordpress")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> PushToWordPress(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new PushArticleToWordPressCommand(id), ct));
}
