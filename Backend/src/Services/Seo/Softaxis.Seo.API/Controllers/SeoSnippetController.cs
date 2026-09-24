using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Snippet.Commands;
using Softaxis.Seo.Application.Snippet.Queries;

namespace Softaxis.Seo.API.Controllers;

/// <summary>
/// Public, anonymous, embedded on a tenant's own website — mirrors CRM's WebhooksController exactly
/// (same "PublicWebhook" CORS policy, already registered in the gateway, no new registration
/// needed). Possession of the opaque snippetKey in the URL is the security boundary, same as CRM's
/// InboundKey — see SeoSite's own remarks on why no separate DNS/meta-tag verification exists.
/// </summary>
[ApiController]
[Route("api/seo/snippet/{snippetKey}")]
[AllowAnonymous]
[EnableCors("PublicWebhook")]
public sealed class SeoSnippetController(ISender sender) : SeoControllerBase
{
    [HttpGet("tag.js")]
    public IActionResult Tag(string snippetKey)
    {
        var origin = $"{Request.Scheme}://{Request.Host}";
        var js = $$"""
        (function () {
          var BASE = "{{origin}}/api/seo/snippet/{{snippetKey}}";

          fetch(BASE + "/ping", { method: "POST" }).catch(function () {});

          fetch(BASE + "/rules?path=" + encodeURIComponent(location.pathname))
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (rules) {
              rules.forEach(function (rule) {
                try { applyRule(rule); } catch (e) { /* one bad rule must not break the page */ }
              });
            })
            .catch(function () {});

          function applyRule(rule) {
            var value = JSON.parse(rule.proposedValueJson).value;
            if (rule.changeType === "title") {
              document.title = value;
            } else if (rule.changeType === "meta_description") {
              setMeta("description", value);
            } else if (rule.changeType === "canonical") {
              setLink("canonical", value);
            } else if (rule.changeType === "schema") {
              var s = document.createElement("script");
              s.type = "application/ld+json";
              s.textContent = value;
              document.head.appendChild(s);
            }
          }

          function setMeta(name, content) {
            var el = document.querySelector('meta[name="' + name + '"]');
            if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
            el.setAttribute("content", content);
          }

          function setLink(rel, href) {
            var el = document.querySelector('link[rel="' + rel + '"]');
            if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
            el.setAttribute("href", href);
          }
        })();
        """;
        return Content(js, "application/javascript; charset=utf-8");
    }

    [HttpPost("ping")]
    public async Task<IActionResult> Ping(string snippetKey, CancellationToken ct)
    {
        await sender.Send(new PingSnippetCommand(snippetKey), ct);
        return Ok(); // always 200 — the snippet must never surface an error to a visitor
    }

    [HttpGet("rules")]
    public async Task<IActionResult> Rules(string snippetKey, [FromQuery] string? path, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSnippetRulesQuery(snippetKey, path), ct));
}
