using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Public, anonymous inbound endpoint for every push-based lead source — webhooks (Zapier,
/// Make.com, n8n), the Custom API, and Website Forms. The tenant + integration are resolved
/// from the unguessable <c>inboundKey</c> in the URL; payloads are signature-verified, stored
/// in the durable inbox, and acknowledged immediately (processing is offloaded to a background
/// worker so the caller is never blocked).
/// </summary>
[ApiController]
[Route("api/webhooks/{inboundKey}")]
[AllowAnonymous]
public sealed class WebhooksController(ISender sender) : ControllerBase
{
    /// <summary>Provider verification handshake (e.g. Meta's hub.challenge).</summary>
    [HttpGet]
    public async Task<IActionResult> Verify(string inboundKey, CancellationToken ct)
    {
        var query = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        var result = await sender.Send(new VerifyWebhookQuery(inboundKey, query), ct);

        if (result.IsFailure) return NotFound(new { result.Error.Code, result.Error.Description });
        return string.IsNullOrEmpty(result.Value) ? Ok(new { ok = true }) : Content(result.Value, "text/plain");
    }

    /// <summary>Receive a lead payload (JSON or HTML form post).</summary>
    [HttpPost]
    public async Task<IActionResult> Ingest(string inboundKey, CancellationToken ct)
    {
        var body = await ReadBodyAsJsonAsync(ct);
        var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString(), StringComparer.OrdinalIgnoreCase);

        var result = await sender.Send(new IngestWebhookCommand(inboundKey, body, headers), ct);
        if (result.IsSuccess) return Ok(result.Value);

        return result.Error.Code switch
        {
            "Webhook.NotFound"     => NotFound(new { result.Error.Code, result.Error.Description }),
            "Webhook.Unauthorized" => Unauthorized(new { result.Error.Code, result.Error.Description }),
            _                      => BadRequest(new { result.Error.Code, result.Error.Description }),
        };
    }

    /// <summary>
    /// Drop-in website snippet. Embed on any site; it captures form submissions and posts them
    /// to this integration's inbound URL — submitted forms appear in CRM automatically.
    /// </summary>
    [HttpGet("snippet.js")]
    public IActionResult Snippet(string inboundKey)
    {
        var url = $"{Request.Scheme}://{Request.Host}/api/webhooks/{inboundKey}";
        var js = $$"""
        (function () {
          var ENDPOINT = "{{url}}";
          function send(data) {
            return fetch(ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });
          }
          function serialize(form) {
            var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o;
          }
          document.addEventListener("submit", function (e) {
            var f = e.target;
            if (!f || !f.hasAttribute || !f.hasAttribute("data-vrodux-lead")) return;
            e.preventDefault();
            send(serialize(f)).then(function () {
              if (f.hasAttribute("data-vrodux-redirect")) location.href = f.getAttribute("data-vrodux-redirect");
              else { f.reset(); var m = f.querySelector("[data-vrodux-success]"); if (m) m.style.display = "block"; }
            });
          }, true);
          window.VroduxLead = { submit: send };
        })();
        """;
        return Content(js, "application/javascript; charset=utf-8");
    }

    /// <summary>Reads the request body as a JSON string, converting HTML form posts to JSON.</summary>
    private async Task<string> ReadBodyAsJsonAsync(CancellationToken ct)
    {
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync(ct);
            var dict = form.ToDictionary(f => f.Key, f => (object?)f.Value.ToString());
            return JsonSerializer.Serialize(dict);
        }

        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        return await reader.ReadToEndAsync(ct);
    }
}
