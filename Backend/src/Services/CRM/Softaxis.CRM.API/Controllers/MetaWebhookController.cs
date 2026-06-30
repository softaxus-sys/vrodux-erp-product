using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// App-level Meta (Facebook/Instagram) leadgen webhook. This is the single callback URL you
/// register in the Meta App dashboard — Meta delivers every page's events here, and the handler
/// fans them out to the matching tenant integrations by page_id.
///
/// Configure in Meta App → Webhooks → Page → Callback URL:
///   {PublicBaseUrl}/api/webhooks/meta   (verify token = Meta:VerifyToken)
/// </summary>
[ApiController]
[Route("api/webhooks/meta")]
[AllowAnonymous]
public sealed class MetaWebhookController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Verify(CancellationToken ct)
    {
        var query = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        var result = await sender.Send(new VerifyMetaWebhookQuery(query), ct);
        return result.IsSuccess ? Content(result.Value, "text/plain") : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Ingest(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(ct);
        var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString(), StringComparer.OrdinalIgnoreCase);

        var result = await sender.Send(new IngestMetaWebhookCommand(body, headers), ct);
        if (result.IsSuccess) return Ok(result.Value);
        // Always 200-on-verified would be ideal, but signature failures should not look successful.
        return result.Error.Code == "Webhook.Unauthorized"
            ? Unauthorized(new { result.Error.Code, result.Error.Description })
            : Ok(new { received = false });
    }
}
