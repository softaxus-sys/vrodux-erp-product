using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Google.Commands;
using Softaxis.Seo.Application.Google.Dtos;
using Softaxis.Seo.Application.Google.Queries;

namespace Softaxis.Seo.API.Controllers;

/// <summary>Google Search Console + Analytics connection flow — OAuth start, the anonymous OAuth
/// callback, property discovery, and final selection. Mirrors CRM's MetaIntegrationController.</summary>
[ApiController]
[Route("api/seo/google")]
[Authorize]
public sealed class SeoGoogleIntegrationController(ISender sender, IConfiguration config) : SeoControllerBase
{
    [HttpPost("{siteId:guid}/oauth/start")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Start(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartGoogleOAuthCommand(siteId, CallbackUri()), ct));

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state,
        [FromQuery(Name = "error")] string? error, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Redirect(FrontendReturn("error", null));

        var result = await sender.Send(new GoogleOAuthCallbackCommand(code, state, CallbackUri()), ct);
        return result.IsSuccess
            ? Redirect(FrontendReturn("connected", result.Value.SiteId))
            : Redirect(FrontendReturn("error", null));
    }

    [HttpGet("{siteId:guid}/properties")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Properties(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetGooglePropertiesQuery(siteId), ct));

    [HttpPost("{siteId:guid}/select")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Select(Guid siteId, [FromBody] SelectGooglePropertiesRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SelectGooglePropertiesCommand(
            siteId, req.GscPropertyId, req.GscPropertyName, req.Ga4PropertyId, req.Ga4PropertyName), ct));

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/seo/google/oauth/callback";

    private string FrontendReturn(string status, Guid? siteId)
    {
        var baseUrl = config["Integrations:FrontendBaseUrl"]
            ?? config.GetSection("AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
        var idPart = siteId is null ? "" : $"&site={siteId}";
        return $"{baseUrl.TrimEnd('/')}/seo/sites?provider=google&status={status}{idPart}";
    }
}
