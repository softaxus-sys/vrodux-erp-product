using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.API.Authorization;
using Softaxis.Identity.Application.Billing.Commands;
using Softaxis.Identity.Application.Billing.Queries;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Subscription + billing for the caller's own tenant.
///
/// <para>
/// Every route here is exempt from <c>SubscriptionEnforcementMiddleware</c> (see its BypassPrefixes)
/// — an expired tenant MUST be able to reach these endpoints, otherwise it could never pay to get
/// its access back. Nothing here exposes tenant business data; only plan and billing state.
/// </para>
/// </summary>
[ApiController]
[Route("api/billing")]
[Authorize]
[Produces("application/json")]
public sealed class BillingController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Current plan, subscription, seat usage and the purchasable catalogue.</summary>
    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetBillingOverviewQuery(), ct));

    /// <summary>Payment history for this tenant.</summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> Invoices(CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetInvoicesQuery(), ct));

    /// <summary>
    /// Start a purchase. Returns the provider URL for the browser to follow.
    /// Spending money is gated on <c>settings.billing.edit</c> — viewing the page is not enough.
    /// </summary>
    [HttpPost("checkout")]
    [RequirePermission("settings.billing.edit")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(
            new CreateCheckoutSessionCommand(req.Plan, req.BillingPeriod, req.Provider), ct));

    /// <summary>Open the provider's hosted management page (Stripe only today).</summary>
    [HttpPost("portal")]
    [RequirePermission("settings.billing.edit")]
    public async Task<IActionResult> Portal(CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreatePortalSessionCommand(), ct));

    /// <summary>Cancel. Defaults to end-of-period so the customer keeps what they've paid for.</summary>
    [HttpPost("cancel")]
    [RequirePermission("settings.billing.edit")]
    public async Task<IActionResult> Cancel([FromBody] CancelRequest? req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CancelSubscriptionCommand(req?.Immediate ?? false), ct));
}

/// <summary>
/// Provider webhooks. Anonymous by necessity — the caller is Stripe/PayPal, not a logged-in user —
/// but never trusted: each handler verifies the cryptographic signature before applying anything,
/// and dedupes on the provider event id.
/// </summary>
[ApiController]
[Route("api/billing/webhooks")]
[AllowAnonymous]
public sealed class BillingWebhooksController(ISender sender) : ControllerBase
{
    [HttpPost("stripe")]
    public async Task<IActionResult> Stripe(CancellationToken ct)
    {
        // Read the raw body: Stripe signs the exact bytes, so model binding would break verification.
        var raw = await ReadBodyAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault();

        var result = await sender.Send(new HandleStripeWebhookCommand(raw, signature), ct);

        // A 4xx tells Stripe to retry. Signature failures are permanent, so they're answered 400
        // (Stripe stops retrying those), while processing failures return 500 to earn a retry.
        if (result.IsFailure)
        {
            return result.Error.Code == "Billing.Stripe.BadSignature"
                ? BadRequest(new { error = result.Error.Description })
                : StatusCode(500, new { error = result.Error.Description });
        }

        return Ok();
    }

    [HttpPost("paypal")]
    public async Task<IActionResult> PayPal(CancellationToken ct)
    {
        var raw = await ReadBodyAsync(ct);

        // PayPal verifies via its own API using these transmission headers; lower-cased for lookup.
        var headers = Request.Headers
            .ToDictionary(h => h.Key.ToLowerInvariant(), h => h.Value.ToString());

        var result = await sender.Send(new HandlePayPalWebhookCommand(raw, headers), ct);

        if (result.IsFailure)
        {
            return result.Error.Code == "Billing.PayPal.BadSignature"
                ? BadRequest(new { error = result.Error.Description })
                : StatusCode(500, new { error = result.Error.Description });
        }

        return Ok();
    }

    private async Task<string> ReadBodyAsync(CancellationToken ct)
    {
        Request.EnableBuffering();
        Request.Body.Position = 0;
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var body = await reader.ReadToEndAsync(ct);
        Request.Body.Position = 0;
        return body;
    }
}

public sealed record CheckoutRequest(string Plan, string BillingPeriod, string Provider);
public sealed record CancelRequest(bool Immediate = false);
