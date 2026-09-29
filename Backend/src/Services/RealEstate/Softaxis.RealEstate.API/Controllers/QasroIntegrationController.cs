using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.QasroIntegrations;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// Connects a workspace to Qasro (qasro.com) — Softaxis's sister property portal — via real OAuth:
/// the tenant admin is redirected to Qasro to log in or sign up, and the connection only proceeds
/// once their agency is approved/active on Qasro's own side. Mirrors MetaIntegrationController and
/// the SEO module's SeoGoogleIntegrationController exactly (OAuth start, anonymous callback).
/// Reuses the same real-estate.website.* permissions as the "own website" integration: both are
/// the same underlying decision ("who may control what gets published externally").
/// </summary>
[ApiController]
[Route("api/real-estate/qasro-integration")]
[Authorize]
public sealed class QasroIntegrationController(ISender sender, IConfiguration config) : RealEstateControllerBase
{
    /// <summary>204 when Qasro has never been connected.</summary>
    [HttpGet]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await sender.Send(new GetQasroIntegrationQuery(), ct);
        return result.IsSuccess && result.Value is null ? NoContent() : OkOrError(result);
    }

    [HttpGet("published")]
    [RequirePermission("real-estate.website.view")]
    public async Task<IActionResult> GetPublished(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetQasroPublishedPropertiesQuery(), ct));

    [HttpPost("oauth/start")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> StartOAuth(CancellationToken ct) =>
        OkOrError(await sender.Send(new StartQasroOAuthCommand(CallbackUri()), ct));

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state,
        [FromQuery(Name = "error")] string? error, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Redirect(FrontendReturn("error"));

        var result = await sender.Send(new QasroOAuthCallbackCommand(code, state, CallbackUri()), ct);
        return Redirect(FrontendReturn(result.IsSuccess ? "connected" : "error"));
    }

    [HttpPost("disconnect")]
    [RequirePermission("real-estate.website.edit")]
    public async Task<IActionResult> Disconnect(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectQasroCommand(), ct));

    /// <summary>Takes every property off Qasro. Uses the property edit permission, like the
    /// per-property toggle and the equivalent "own website" endpoint.</summary>
    [HttpPost("withdraw-all")]
    [RequirePermission("real-estate.properties.edit")]
    public async Task<IActionResult> WithdrawAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new WithdrawAllQasroListingsCommand(), ct));

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/real-estate/qasro-integration/oauth/callback";

    private string FrontendReturn(string status)
    {
        var baseUrl = config["Integrations:FrontendBaseUrl"]
            ?? config.GetSection("AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
        return $"{baseUrl.TrimEnd('/')}/real-estate/website?provider=qasro&status={status}";
    }
}
