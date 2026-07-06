using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
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
[EnableCors("PublicWebhook")]   // embeddable on any tenant website — any-origin (see gateway CORS)
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

    /// <summary>
    /// Vrodux-hosted lead capture form. A tenant embeds this as an <c>&lt;iframe&gt;</c> on their
    /// website; on submit it posts straight to this integration's inbound URL, so leads land in
    /// CRM with zero coding. Served with permissive framing so it can be embedded on any site.
    /// </summary>
    [HttpGet("form")]
    public IActionResult Form(string inboundKey)
    {
        var endpoint = $"{Request.Scheme}://{Request.Host}/api/webhooks/{inboundKey}";

        // Allow this page to be framed on any customer site (override any global X-Frame-Options).
        Response.Headers.Remove("X-Frame-Options");
        Response.Headers["Content-Security-Policy"] = "frame-ancestors *";

        var html = $$"""
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Get in touch</title>
          <style>
            :root { color-scheme: light dark; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
                   background: transparent; color: #0f172a; }
            .card { max-width: 460px; margin: 0 auto; padding: 20px; }
            h2 { margin: 0 0 4px; font-size: 18px; }
            p.sub { margin: 0 0 16px; font-size: 13px; color: #64748b; }
            .row { display: flex; gap: 12px; }
            .row > .field { flex: 1; }
            .field { margin-bottom: 12px; }
            label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
            input, textarea { width: 100%; padding: 9px 11px; font-size: 14px; border: 1px solid #cbd5e1;
                   border-radius: 8px; background: #fff; color: #0f172a; outline: none; }
            input:focus, textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
            textarea { resize: vertical; min-height: 72px; }
            button { width: 100%; padding: 11px; font-size: 14px; font-weight: 600; color: #fff;
                   background: #4f46e5; border: 0; border-radius: 8px; cursor: pointer; margin-top: 4px; }
            button:hover { background: #4338ca; }
            button:disabled { opacity: .6; cursor: not-allowed; }
            .ok { text-align: center; padding: 28px 12px; }
            .ok .tick { width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; color: #16a34a;
                   display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 10px; }
            .err { display: none; font-size: 13px; color: #dc2626; margin-bottom: 10px; }
            .brand { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 14px; }
            @media (prefers-color-scheme: dark) {
              body { color: #e2e8f0; }
              p.sub { color: #94a3b8; }
              label { color: #cbd5e1; }
              input, textarea { background: #1e293b; border-color: #334155; color: #e2e8f0; }
              .ok .tick { background: rgba(22,163,74,.2); }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <form id="f">
              <h2>Get in touch</h2>
              <p class="sub">Fill in your details and we'll get back to you shortly.</p>
              <div class="err" id="err"></div>
              <div class="row">
                <div class="field"><label>First name</label><input name="first_name" autocomplete="given-name" required /></div>
                <div class="field"><label>Last name</label><input name="last_name" autocomplete="family-name" /></div>
              </div>
              <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required /></div>
              <div class="row">
                <div class="field"><label>Phone</label><input name="phone" type="tel" autocomplete="tel" /></div>
                <div class="field"><label>WhatsApp</label><input name="whatsapp" type="tel" /></div>
              </div>
              <div class="field"><label>Company</label><input name="company" autocomplete="organization" /></div>
              <div class="field"><label>Interested in</label><input name="interested_in" placeholder="Product or service" /></div>
              <div class="field"><label>Budget</label><input name="budget" placeholder="e.g. 50k–100k" /></div>
              <div class="field"><label>Message</label><textarea name="message" placeholder="How can we help?"></textarea></div>
              <button type="submit" id="btn">Submit</button>
              <div class="brand">Powered by Vrodux CRM</div>
            </form>
            <div class="ok" id="ok" style="display:none">
              <div class="tick">&#10003;</div>
              <h2>Thank you!</h2>
              <p class="sub">Your details have been received. We'll be in touch soon.</p>
            </div>
          </div>
          <script>
            (function () {
              var ENDPOINT = "{{endpoint}}";
              var f = document.getElementById("f"), btn = document.getElementById("btn"), err = document.getElementById("err");
              f.addEventListener("submit", function (e) {
                e.preventDefault();
                err.style.display = "none";
                btn.disabled = true; btn.textContent = "Submitting…";
                var o = {}; new FormData(f).forEach(function (v, k) { if (v) o[k] = v; });
                o.form_name = "Vrodux Web Form"; o.source = "website";
                fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) })
                  .then(function (r) { if (!r.ok) throw new Error(); f.style.display = "none"; document.getElementById("ok").style.display = "block"; })
                  .catch(function () { err.textContent = "Something went wrong. Please try again."; err.style.display = "block";
                                       btn.disabled = false; btn.textContent = "Submit"; });
              });
            })();
          </script>
        </body>
        </html>
        """;
        return Content(html, "text/html; charset=utf-8");
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
