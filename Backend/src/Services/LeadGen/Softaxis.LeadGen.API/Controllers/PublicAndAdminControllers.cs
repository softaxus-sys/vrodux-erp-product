using System.Net;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using Softaxis.LeadGen.API.Controllers.Common;
using Softaxis.LeadGen.API.Extensions;
using Softaxis.LeadGen.Application.Credits;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.API.Controllers;

/// <summary>
/// The page a recipient lands on from the unsubscribe link at the bottom of an email. Anonymous — the
/// recipient has no account — so the sealed token in the URL is the only credential.
///
/// Opening the link shows who would be unsubscribed and asks for one click; the click is what acts.
/// Mail scanners and link previews fetch every URL in a message, and an action taken on GET would
/// silently unsubscribe everyone behind one. The POST also serves RFC 8058 one-click unsubscribe,
/// which mail apps send themselves.
/// </summary>
[Route("api/leadgen/unsubscribe")][AllowAnonymous]
[EnableRateLimiting(LeadGenRateLimitPolicies.Public)]
public sealed class UnsubscribeController(IUnsubscribeService service) : ControllerBase
{
    [HttpGet("{token}")]
    public async Task<IActionResult> Page(string token, CancellationToken ct)
    {
        var info = await service.DescribeAsync(token, ct);
        if (info is null) return Html(HttpStatusCode.NotFound, Layout("This link is not valid",
            "<p>This unsubscribe link is invalid or has been altered. If you keep receiving unwanted email, reply to it and ask to be removed.</p>"));

        var who = WebUtility.HtmlEncode(info.Email);
        var from = string.IsNullOrWhiteSpace(info.SenderName) ? "" : $" from <strong>{WebUtility.HtmlEncode(info.SenderName)}</strong>";
        return Html(HttpStatusCode.OK, Layout("Unsubscribe",
            $"<p>Stop receiving email{from} at <strong>{who}</strong>?</p>" +
            "<form method=\"post\"><button type=\"submit\">Yes, unsubscribe me</button></form>" +
            "<p class=\"muted\">You can close this page if you changed your mind.</p>"));
    }

    [HttpPost("{token}")]
    public async Task<IActionResult> Confirm(string token, CancellationToken ct)
    {
        var ok = await service.ConfirmAsync(token, ct);
        // A mail app doing one-click unsubscribe wants a plain success; a person wants a page.
        if (Request.HasFormContentType && Request.Form.ContainsKey("List-Unsubscribe") && ok) return Ok();
        return ok
            ? Html(HttpStatusCode.OK, Layout("You are unsubscribed", "<p>You have been unsubscribed and will not receive further email from this sender. It can take a few minutes for any message already on its way to stop.</p>"))
            : Html(HttpStatusCode.NotFound, Layout("This link is not valid", "<p>This unsubscribe link is invalid or has been altered.</p>"));
    }

    private ContentResult Html(HttpStatusCode status, string html)
    {
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-store";
        // The page has no scripts and nothing to frame.
        Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";
        return new ContentResult { Content = html, ContentType = "text/html; charset=utf-8", StatusCode = (int)status };
    }

    private static string Layout(string title, string body) =>
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        $"<title>{WebUtility.HtmlEncode(title)}</title><style>body{{font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;margin:0;color:#1f2937}}" +
        ".card{max-width:460px;margin:12vh auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.12)}" +
        "h1{font-size:20px;margin:0 0 16px}p{line-height:1.55}.muted{color:#6b7280;font-size:13px}" +
        "button{background:#111827;color:#fff;border:0;border-radius:8px;padding:11px 18px;font-size:15px;cursor:pointer}</style></head>" +
        $"<body><div class=\"card\"><h1>{WebUtility.HtmlEncode(title)}</h1>{body}</div></body></html>";
}

/// <summary>
/// Stripe's call-back when a card payment completes. This, not the browser redirect, is what adds
/// credits: the body is verified against the signing secret first, and a request that fails the check
/// is refused before anything is read from it. With no secret configured every call is refused.
/// </summary>
[Route("api/leadgen/billing/webhook")][AllowAnonymous]
public sealed class BillingWebhookController(
    ICreditPayments payments, ICreditFulfilment fulfilment, ILogger<BillingWebhookController> logger) : ControllerBase
{
    [HttpPost("stripe")]
    public async Task<IActionResult> Stripe(CancellationToken ct)
    {
        // The signature covers the exact bytes sent, so read the raw body — never a re-serialised copy.
        string payload;
        using (var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8)) payload = await reader.ReadToEndAsync(ct);

        if (!payments.VerifyStripeSignature(payload, Request.Headers["Stripe-Signature"].FirstOrDefault()))
        {
            logger.LogWarning("Rejected a Stripe webhook with a bad or missing signature.");
            return BadRequest();
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var type = doc.RootElement.GetProperty("type").GetString();
            var obj = doc.RootElement.GetProperty("data").GetProperty("object");
            var id = obj.TryGetProperty("id", out var i) ? i.GetString() : null;
            if (id is null) return Ok();

            switch (type)
            {
                case "checkout.session.completed":
                case "checkout.session.async_payment_succeeded":
                    // "completed" can arrive before a delayed method (bank debit) has actually paid.
                    if (obj.TryGetProperty("payment_status", out var ps) && ps.GetString() != "paid") break;
                    var amount = obj.TryGetProperty("amount_total", out var a) && a.ValueKind == JsonValueKind.Number ? a.GetInt64() : (long?)null;
                    var currency = obj.TryGetProperty("currency", out var c) ? c.GetString() : null;
                    await fulfilment.FulfilAsync("stripe", id, amount, currency, ct);
                    break;
                case "checkout.session.expired":
                case "checkout.session.async_payment_failed":
                    await fulfilment.FailAsync("stripe", id, type == "checkout.session.expired" ? "Checkout expired." : "Payment failed.", ct);
                    break;
            }
            return Ok();
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException)
        {
            logger.LogWarning(ex, "Unreadable Stripe webhook body.");
            return BadRequest();
        }
    }
}

/// <summary>
/// Platform administration of Lead Generation: what a credit costs, the packs on sale, the daily caps
/// and the sending limits that protect the platform, and a view across every workspace. Super admin
/// only — a workspace administrator can never reach these.
/// </summary>
[Route("api/admin/leadgen")][Authorize(Policy = "SuperAdminOnly")]
public sealed class AdminController(ISender sender) : LeadGenControllerBase
{
    public sealed record GrantRequest(Guid TenantId, int Amount, string Reason);

    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct) => OkOrError(await sender.Send(new AdminOverviewQuery(), ct));

    [HttpGet("settings")]
    public async Task<IActionResult> Settings(CancellationToken ct) => OkOrError(await sender.Send(new GetPlatformSettingsQuery(), ct));

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] PlatformSettingsDto s, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePlatformSettingsCommand(s), ct));

    [HttpGet("packs")]
    public async Task<IActionResult> Packs(CancellationToken ct) => OkOrError(await sender.Send(new AdminGetPacksQuery(), ct));

    [HttpPost("packs")]
    public async Task<IActionResult> CreatePack([FromBody] PackInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertPackCommand(null, input), ct));

    [HttpPut("packs/{id:guid}")]
    public async Task<IActionResult> UpdatePack(Guid id, [FromBody] PackInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertPackCommand(id, input), ct));

    [HttpDelete("packs/{id:guid}")]
    public async Task<IActionResult> DeletePack(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeletePackCommand(id), ct));

    [HttpPost("grant")]
    public async Task<IActionResult> Grant([FromBody] GrantRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AdminGrantCreditsCommand(r.TenantId, r.Amount, r.Reason), ct));
}
