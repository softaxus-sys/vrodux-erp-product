using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Application.Billing.Commands;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;
using Stripe;
using Stripe.Checkout;

// Stripe.Subscription collides with our own aggregate — alias ours so every signature is unambiguous.
using DomainSubscription = Softaxis.Identity.Domain.Entities.Subscription;

namespace Softaxis.Identity.Infrastructure.Handlers.Billing;

/// <summary>
/// The only place a tenant becomes paid.
///
/// <para>Three defences, applied in order:</para>
/// <list type="number">
///   <item><b>Signature</b> — an unverified body is discarded. Without it, anyone who learns the URL
///   could POST "payment succeeded" and get the product for free.</item>
///   <item><b>Idempotency</b> — every event id is recorded once. Stripe retries on any non-2xx and can
///   deliver duplicates even after success; re-applying <c>invoice.paid</c> would extend a paid period twice.</item>
///   <item><b>Server-side reconciliation</b> — the tenant is read from metadata Stripe echoes back from
///   what WE set at checkout, never from anything the browser returns.</item>
/// </list>
/// </summary>
internal sealed class HandleStripeWebhookCommandHandler(
    ITenantRepository        tenantRepo,
    ISubscriptionRepository  subRepo,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow,
    IOptionsSnapshot<BillingOptions> options,
    ILogger<HandleStripeWebhookCommandHandler> logger)
    : ICommandHandler<HandleStripeWebhookCommand>
{
    public async Task<Result> Handle(HandleStripeWebhookCommand cmd, CancellationToken ct)
    {
        var cfg = options.Value.Stripe;

        if (string.IsNullOrWhiteSpace(cfg.WebhookSecret))
        {
            // Fail closed — an unverifiable endpoint must never mutate billing state.
            logger.LogError("Stripe webhook received but Billing:Stripe:WebhookSecret is not configured — rejecting.");
            return Result.Failure(Error.Custom("Billing.Stripe.NoWebhookSecret", "Webhook signing secret is not configured."));
        }

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(cmd.RawBody, cmd.Signature, cfg.WebhookSecret);
        }
        catch (StripeException ex)
        {
            logger.LogWarning(ex, "Rejected Stripe webhook with an invalid signature.");
            return Result.Failure(Error.Custom("Billing.Stripe.BadSignature", "Invalid webhook signature."));
        }

        // ── Idempotency ──────────────────────────────────────────────────────
        if (await subRepo.WebhookEventExistsAsync(PaymentProvider.Stripe, stripeEvent.Id, ct))
        {
            logger.LogInformation("Stripe event {EventId} ({Type}) already processed — acknowledging without re-applying.",
                stripeEvent.Id, stripeEvent.Type);
            return Result.Success();
        }

        var record = new BillingWebhookEvent(PaymentProvider.Stripe, stripeEvent.Id, stripeEvent.Type, cmd.RawBody);
        subRepo.AddWebhookEvent(record);

        try
        {
            await ApplyAsync(stripeEvent, ct);
            record.MarkProcessed();
        }
        catch (Exception ex)
        {
            // Keep the row (with the error) so the failure is visible rather than silent, and return a
            // failure so Stripe retries. The retry will see the recorded id — an operator must inspect
            // rows where Error is set and ProcessedAt is null.
            logger.LogError(ex, "Failed to apply Stripe event {EventId} ({Type}).", stripeEvent.Id, stripeEvent.Type);
            record.MarkFailed(ex.ToString());
            await uow.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("Billing.Stripe.ApplyFailed", "Failed to process the webhook."));
        }

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task ApplyAsync(Event stripeEvent, CancellationToken ct)
    {
        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await OnCheckoutCompleted(stripeEvent.Data.Object as Session, ct);
                break;

            case "customer.subscription.created":
            case "customer.subscription.updated":
                await OnSubscriptionChanged(stripeEvent.Data.Object as Stripe.Subscription, ct);
                break;

            case "customer.subscription.deleted":
                await OnSubscriptionDeleted(stripeEvent.Data.Object as Stripe.Subscription, ct);
                break;

            case "invoice.paid":
            case "invoice.payment_succeeded":
                await OnInvoicePaid(stripeEvent.Data.Object as Invoice, ct);
                break;

            case "invoice.payment_failed":
                await OnInvoicePaymentFailed(stripeEvent.Data.Object as Invoice, ct);
                break;

            default:
                logger.LogDebug("Ignoring unhandled Stripe event type {Type}.", stripeEvent.Type);
                break;
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private async Task OnCheckoutCompleted(Session? session, CancellationToken ct)
    {
        if (session is null) return;

        var tenantId = ResolveTenantId(session.ClientReferenceId, session.Metadata);
        if (tenantId is null)
        {
            logger.LogWarning("Stripe checkout {SessionId} carried no resolvable tenant id.", session.Id);
            return;
        }

        var tenant = await tenantRepo.GetByIdAsync(tenantId.Value, ct);
        if (tenant is null)
        {
            logger.LogWarning("Stripe checkout {SessionId} references unknown tenant {TenantId}.", session.Id, tenantId);
            return;
        }

        var plan   = ParsePlan(session.Metadata, tenant.Plan);
        var period = ParsePeriod(session.Metadata);

        var subscription = await subRepo.GetByTenantAsync(tenant.Id, ct);
        if (subscription is null)
        {
            var amount = PlanDefinitions.PriceOf(plan).AmountFor(period) ?? 0m;
            subscription = DomainSubscription.Start(tenant.Id, plan, period, PaymentProvider.Stripe, amount, options.Value.Currency);
            subRepo.Add(subscription);
        }

        subscription.LinkProvider(session.CustomerId, session.SubscriptionId);
        subscription.Activate(DateTime.UtcNow, null);   // exact period arrives with subscription.updated

        // Money is in: move the tenant onto the paid tier and restore access. This is also the path
        // that reactivates a previously expired tenant — whose data was never touched.
        tenant.ActivatePaid(plan, null);
        accessCache.Invalidate(tenant.Id);

        logger.LogInformation("Stripe checkout completed for tenant {TenantId} on {Plan}/{Period}.", tenant.Id, plan, period);
    }

    private async Task OnSubscriptionChanged(Stripe.Subscription? stripeSub, CancellationToken ct)
    {
        if (stripeSub is null) return;

        var subscription = await ResolveSubscriptionAsync(stripeSub, ct);
        if (subscription is null) return;

        subscription.LinkProvider(stripeSub.CustomerId, stripeSub.Id);

        var item        = stripeSub.Items?.Data?.FirstOrDefault();
        var periodStart = item?.CurrentPeriodStart;
        var periodEnd   = item?.CurrentPeriodEnd;

        switch (stripeSub.Status)
        {
            case "active":
            case "trialing":
                subscription.Activate(periodStart, periodEnd);
                await SyncTenantAsync(subscription, periodEnd, ct);
                break;

            case "past_due":
            case "unpaid":
                // Retain access while Stripe retries — dunning, not eviction.
                subscription.MarkPastDue();
                break;

            case "canceled":
                subscription.Cancel(immediate: true);
                await SyncTenantAsync(subscription, DateTime.UtcNow, ct);
                break;
        }

        if (stripeSub.CancelAtPeriodEnd && subscription.Status == SubscriptionStatus.Active)
            subscription.Cancel(immediate: false);
    }

    private async Task OnSubscriptionDeleted(Stripe.Subscription? stripeSub, CancellationToken ct)
    {
        if (stripeSub is null) return;

        var subscription = await ResolveSubscriptionAsync(stripeSub, ct);
        if (subscription is null) return;

        subscription.Expire();

        // Gate access, delete nothing — the tenant can resubscribe and resume where they left off.
        var tenant = await tenantRepo.GetByIdAsync(subscription.TenantId, ct);
        if (tenant is not null)
        {
            tenant.Expire();
            accessCache.Invalidate(tenant.Id);
        }

        logger.LogInformation("Stripe subscription {SubId} deleted; tenant {TenantId} expired (data retained).",
            stripeSub.Id, subscription.TenantId);
    }

    private async Task OnInvoicePaid(Invoice? invoice, CancellationToken ct)
    {
        if (invoice is null) return;

        var subscription = await ResolveSubscriptionForInvoiceAsync(invoice, ct);
        if (subscription is null) return;

        var existing = await subRepo.GetInvoiceAsync(PaymentProvider.Stripe, invoice.Id, ct);
        if (existing is not null)
        {
            existing.MarkPaid(invoice.StatusTransitions?.PaidAt ?? DateTime.UtcNow);
            return;
        }

        var record = new SubscriptionInvoice(
            subscription.Id, subscription.TenantId, PaymentProvider.Stripe, invoice.Id,
            invoice.AmountPaid / 100m,                       // Stripe reports minor units
            (invoice.Currency ?? "usd").ToUpperInvariant(),
            InvoiceStatus.Paid);

        record.SetPeriod(invoice.PeriodStart, invoice.PeriodEnd);
        record.SetLinks(invoice.HostedInvoiceUrl, invoice.InvoicePdf);
        record.MarkPaid(invoice.StatusTransitions?.PaidAt ?? DateTime.UtcNow);
        subRepo.AddInvoice(record);

        // A successful renewal clears past-due and re-opens access.
        if (subscription.Status is SubscriptionStatus.PastDue or SubscriptionStatus.Incomplete)
        {
            subscription.Activate(invoice.PeriodStart, invoice.PeriodEnd);
            await SyncTenantAsync(subscription, invoice.PeriodEnd, ct);
        }
    }

    private async Task OnInvoicePaymentFailed(Invoice? invoice, CancellationToken ct)
    {
        if (invoice is null) return;

        var subscription = await ResolveSubscriptionForInvoiceAsync(invoice, ct);
        if (subscription is null) return;

        subscription.MarkPastDue();

        if (await subRepo.GetInvoiceAsync(PaymentProvider.Stripe, invoice.Id, ct) is null)
        {
            var record = new SubscriptionInvoice(
                subscription.Id, subscription.TenantId, PaymentProvider.Stripe, invoice.Id,
                invoice.AmountDue / 100m,
                (invoice.Currency ?? "usd").ToUpperInvariant(),
                InvoiceStatus.Failed);
            record.SetPeriod(invoice.PeriodStart, invoice.PeriodEnd);
            record.SetLinks(invoice.HostedInvoiceUrl, invoice.InvoicePdf);
            subRepo.AddInvoice(record);
        }

        logger.LogWarning("Stripe payment failed for tenant {TenantId}; subscription marked past due.", subscription.TenantId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Mirror subscription state onto the tenant so entitlement and access always agree.</summary>
    private async Task SyncTenantAsync(DomainSubscription subscription, DateTime? paidUntil, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(subscription.TenantId, ct);
        if (tenant is null) return;

        if (subscription.GrantsAccess)
            tenant.ActivatePaid(subscription.Plan, paidUntil);
        else
            tenant.Expire();

        accessCache.Invalidate(tenant.Id);
    }

    private async Task<DomainSubscription?> ResolveSubscriptionAsync(Stripe.Subscription stripeSub, CancellationToken ct)
    {
        var byId = await subRepo.GetByProviderSubscriptionIdAsync(stripeSub.Id, ct);
        if (byId is not null) return byId;

        // A subscription event can beat the checkout.session.completed that links the id —
        // fall back to the metadata we attached at checkout.
        var tenantId = ResolveTenantId(null, stripeSub.Metadata);
        if (tenantId is null)
        {
            logger.LogWarning("Stripe subscription {SubId} could not be matched to a tenant.", stripeSub.Id);
            return null;
        }

        var sub = await subRepo.GetByTenantAsync(tenantId.Value, ct);
        sub?.LinkProvider(stripeSub.CustomerId, stripeSub.Id);
        return sub;
    }

    private async Task<DomainSubscription?> ResolveSubscriptionForInvoiceAsync(Invoice invoice, CancellationToken ct)
    {
        var tenantId = ResolveTenantId(null, invoice.Metadata);
        if (tenantId is not null)
        {
            var byTenant = await subRepo.GetByTenantAsync(tenantId.Value, ct);
            if (byTenant is not null) return byTenant;
        }

        if (!string.IsNullOrWhiteSpace(invoice.CustomerId))
        {
            var byCustomer = await subRepo.GetByProviderCustomerIdAsync(invoice.CustomerId, ct);
            if (byCustomer is not null) return byCustomer;
        }

        logger.LogWarning("Stripe invoice {InvoiceId} could not be matched to a subscription.", invoice.Id);
        return null;
    }

    private static Guid? ResolveTenantId(string? clientReferenceId, IDictionary<string, string>? metadata)
    {
        if (Guid.TryParse(clientReferenceId, out var fromRef)) return fromRef;

        if (metadata is not null &&
            metadata.TryGetValue("tenant_id", out var raw) &&
            Guid.TryParse(raw, out var fromMeta))
            return fromMeta;

        return null;
    }

    private static PlanType ParsePlan(IDictionary<string, string>? metadata, PlanType fallback) =>
        metadata is not null && metadata.TryGetValue("plan", out var raw) &&
        Enum.TryParse<PlanType>(raw, ignoreCase: true, out var plan)
            ? plan
            : fallback;

    private static BillingPeriod ParsePeriod(IDictionary<string, string>? metadata) =>
        metadata is not null && metadata.TryGetValue("billing_period", out var raw) &&
        Enum.TryParse<BillingPeriod>(raw, ignoreCase: true, out var period)
            ? period
            : BillingPeriod.Annual;
}
