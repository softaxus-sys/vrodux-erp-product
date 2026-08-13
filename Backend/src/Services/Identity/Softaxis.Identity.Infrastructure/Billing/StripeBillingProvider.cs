using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Stripe;
using Stripe.Checkout;

// Stripe.Subscription collides with our own aggregate — alias ours so every signature is unambiguous.
using DomainSubscription = Softaxis.Identity.Domain.Entities.Subscription;

namespace Softaxis.Identity.Infrastructure.Billing;

/// <summary>
/// Stripe implementation: Checkout Session for purchase, Billing Portal for self-service management.
/// <para>
/// Using Stripe's hosted Checkout and Portal means card data never touches our servers (no PCI
/// surface) and the whole update-card / change-plan / cancel UI comes for free.
/// </para>
/// </summary>
internal sealed class StripeBillingProvider(
    IOptionsSnapshot<BillingOptions> options,
    ILogger<StripeBillingProvider> logger) : IBillingProvider
{
    private readonly BillingOptions _billing = options.Value;
    private StripeOptions Cfg => _billing.Stripe;

    public PaymentProvider Provider => PaymentProvider.Stripe;
    public bool IsConfigured => Cfg.IsConfigured;

    private StripeClient Client() => new(Cfg.SecretKey);

    public async Task<Result<string>> CreateCheckoutUrlAsync(
        Tenant tenant, PlanType plan, BillingPeriod period, string successUrl, string cancelUrl, CancellationToken ct)
    {
        if (!IsConfigured)
            return Result.Failure<string>(Error.Custom("Billing.Stripe.NotConfigured", "Stripe is not configured on this server."));

        var priceId = Cfg.PriceFor(plan, period);
        if (priceId is null)
            return Result.Failure<string>(Error.Custom(
                "Billing.Stripe.PriceMissing",
                $"No Stripe price is configured for {plan} / {period}. Add Billing:Stripe:Prices:{plan}:{period}."));

        try
        {
            var service = new SessionService(Client());

            var session = await service.CreateAsync(new SessionCreateOptions
            {
                Mode       = "subscription",
                LineItems  = [new SessionLineItemOptions { Price = priceId, Quantity = 1 }],
                SuccessUrl = successUrl,
                CancelUrl  = cancelUrl,

                // Reconciliation keys. The webhook trusts THESE, never anything the browser returns —
                // a user could otherwise craft a success redirect and self-activate without paying.
                ClientReferenceId = tenant.Id.ToString(),
                CustomerEmail     = string.IsNullOrWhiteSpace(tenant.ContactEmail) ? null : tenant.ContactEmail,
                Metadata = new Dictionary<string, string>
                {
                    ["tenant_id"]      = tenant.Id.ToString(),
                    ["tenant_slug"]    = tenant.Slug,
                    ["plan"]           = plan.ToString(),
                    ["billing_period"] = period.ToString(),
                },
                SubscriptionData = new SessionSubscriptionDataOptions
                {
                    // Copied onto the subscription itself, so later lifecycle events
                    // (renewal, cancellation) still identify the tenant.
                    Metadata = new Dictionary<string, string>
                    {
                        ["tenant_id"]      = tenant.Id.ToString(),
                        ["plan"]           = plan.ToString(),
                        ["billing_period"] = period.ToString(),
                    },
                },
            }, cancellationToken: ct);

            return Result.Success(session.Url);
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe checkout session failed for tenant {TenantId}.", tenant.Id);
            return Result.Failure<string>(Error.Custom("Billing.Stripe.Error", ex.StripeError?.Message ?? ex.Message));
        }
    }

    public async Task<Result<string>> CreateManagementUrlAsync(DomainSubscription subscription, string returnUrl, CancellationToken ct)
    {
        if (!IsConfigured)
            return Result.Failure<string>(Error.Custom("Billing.Stripe.NotConfigured", "Stripe is not configured on this server."));

        if (string.IsNullOrWhiteSpace(subscription.ProviderCustomerId))
            return Result.Failure<string>(Error.Custom(
                "Billing.Stripe.NoCustomer",
                "This subscription has no Stripe customer yet. Complete a checkout first."));

        try
        {
            var service = new Stripe.BillingPortal.SessionService(Client());
            var session = await service.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
            {
                Customer  = subscription.ProviderCustomerId,
                ReturnUrl = returnUrl,
            }, cancellationToken: ct);

            return Result.Success(session.Url);
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe portal session failed for subscription {SubscriptionId}.", subscription.Id);
            return Result.Failure<string>(Error.Custom("Billing.Stripe.Error", ex.StripeError?.Message ?? ex.Message));
        }
    }

    public async Task<Result> CancelAsync(DomainSubscription subscription, bool immediate, CancellationToken ct)
    {
        if (!IsConfigured)
            return Result.Failure(Error.Custom("Billing.Stripe.NotConfigured", "Stripe is not configured on this server."));

        if (string.IsNullOrWhiteSpace(subscription.ProviderSubscriptionId))
            return Result.Failure(Error.Custom("Billing.Stripe.NoSubscription", "No Stripe subscription to cancel."));

        try
        {
            var service = new SubscriptionService(Client());

            if (immediate)
            {
                await service.CancelAsync(subscription.ProviderSubscriptionId, cancellationToken: ct);
            }
            else
            {
                // Keep serving the customer through the period they already paid for.
                await service.UpdateAsync(subscription.ProviderSubscriptionId,
                    new SubscriptionUpdateOptions { CancelAtPeriodEnd = true }, cancellationToken: ct);
            }

            return Result.Success();
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe cancel failed for subscription {SubscriptionId}.", subscription.Id);
            return Result.Failure(Error.Custom("Billing.Stripe.Error", ex.StripeError?.Message ?? ex.Message));
        }
    }
}
