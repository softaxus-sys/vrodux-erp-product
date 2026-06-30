using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Meta (Facebook/Instagram) Lead Ads connection flow: OAuth start, the anonymous OAuth
/// callback, page/form discovery, and final selection. Tenant-scoped + permission-gated
/// (except the callback, which Facebook calls without a JWT and which resolves the tenant
/// from the signed OAuth state).
/// </summary>
[ApiController]
[Route("api/crm/integrations/meta")]
[Authorize]
public sealed class MetaIntegrationController(ISender sender, IConfiguration config) : CrmControllerBase
{
    [HttpPost("{id:guid}/oauth/start")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartMetaOAuthCommand(id, CallbackUri()), ct));

    [HttpGet("oauth/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state,
        [FromQuery(Name = "error")] string? error, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Redirect(FrontendReturn("error", null));

        var result = await sender.Send(new MetaOAuthCallbackCommand(code, state, CallbackUri()), ct);
        return result.IsSuccess
            ? Redirect(FrontendReturn("connected", result.Value.IntegrationId))
            : Redirect(FrontendReturn("error", null));
    }

    [HttpGet("{id:guid}/pages")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> Pages(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMetaPagesQuery(id), ct));

    [HttpGet("{id:guid}/forms")]
    [RequirePermission("settings.integrations.view")]
    public async Task<IActionResult> Forms(Guid id, [FromQuery] string pageId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMetaFormsQuery(id, pageId), ct));

    [HttpPost("{id:guid}/select")]
    [RequirePermission("settings.integrations.edit")]
    public async Task<IActionResult> Select(Guid id, [FromBody] SelectRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SelectMetaTargetsCommand(id, req.Pages), ct));

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/crm/integrations/meta/oauth/callback";

    private string FrontendReturn(string status, Guid? integrationId)
    {
        var baseUrl = config["Integrations:FrontendBaseUrl"]
            ?? config.GetSection("AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
        var idPart = integrationId is null ? "" : $"&integration={integrationId}";
        return $"{baseUrl.TrimEnd('/')}/settings/integrations?provider=meta&status={status}{idPart}";
    }

    public sealed record SelectRequest(IReadOnlyList<MetaPageSelection> Pages);
}
