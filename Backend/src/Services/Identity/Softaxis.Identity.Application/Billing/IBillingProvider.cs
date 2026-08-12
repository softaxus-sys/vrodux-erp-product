using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Application.Billing;

/// <summary>
/// What a payment provider must do for us. Stripe and PayPal differ wildly in their APIs but
/// converge here, so the CQRS handlers, the <see cref="Subscription"/> aggregate and the billing UI
/// stay provider-agnostic — adding a third processor is one class plus a DI line.
/// </summary>
public interface IBillingProvider
{
    PaymentProvider Provider { get; }

    /// <summary>False when the server has no credentials configured; such a provider is never offered to users.</summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Begin a subscription purchase. Returns the URL to send the browser to.
    /// Implementations must attach the tenant id to the provider-side object so the webhook can be
    /// reconciled without trusting anything the client sends back.
    /// </summary>
    Task<Result<string>> CreateCheckoutUrlAsync(
        Tenant tenant, PlanType plan, BillingPeriod period, string successUrl, string cancelUrl, CancellationToken ct);

    /// <summary>
    /// URL of a provider-hosted management page (update card, change plan, cancel), when supported.
    /// Returns a failure for providers with no equivalent, so callers can fall back to in-app controls.
    /// </summary>
    Task<Result<string>> CreateManagementUrlAsync(Subscription subscription, string returnUrl, CancellationToken ct);

    /// <summary>Cancel at the provider. <paramref name="immediate"/> false = let the paid period run out.</summary>
    Task<Result> CancelAsync(Subscription subscription, bool immediate, CancellationToken ct);
}
