using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Application.Billing.Commands;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Super-admin only. Platform billing configuration — which payment providers are live, the
/// price/plan ids from each dashboard, and the billing currency.
///
/// <para>
/// Secrets are NOT settable here and are never returned: the Stripe secret key, the PayPal client
/// id/secret and both webhook signing secrets come from environment variables
/// (<c>/opt/vrodux/shared/.env</c>). This endpoint only reports whether each one is present, so
/// the screen can distinguish "turned off" from "turned on but missing credentials".
/// </para>
/// </summary>
[ApiController]
[Route("api/admin/billing-config")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class BillingAdminController(ISender sender) : BaseApiController(sender)
{
    // GET /api/admin/billing-config
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetBillingConfigQuery(), ct));

    // PUT /api/admin/billing-config
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateBillingConfigRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateBillingConfigCommand(
            Currency:         req.Currency,
            StripeEnabled:    req.StripeEnabled,
            StripePrices:     req.StripePrices,
            PayPalEnabled:    req.PayPalEnabled,
            PayPalUseSandbox: req.PayPalUseSandbox,
            PayPalPlans:      req.PayPalPlans,
            UpdatedBy:        User.FindFirstValue(ClaimTypes.Email)
                           ?? User.FindFirstValue(ClaimTypes.Name)), ct));
}
