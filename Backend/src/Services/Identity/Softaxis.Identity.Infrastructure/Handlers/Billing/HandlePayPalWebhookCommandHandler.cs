using System.Text.Json;
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
using Softaxis.Identity.Infrastructure.Billing;

namespace Softaxis.Identity.Infrastructure.Handlers.Billing;

/// <summary>
/// PayPal counterpart to the Stripe webhook handler, with the same three defences:
/// verify the signature, dedupe on the provider event id, and reconcile the tenant from
/// <c>custom_id</c> (which WE set at subscription creation) rather than anything the browser returns.
/// </summary>
internal sealed class HandlePayPalWebhookCommandHandler(
    ITenantRepository             tenantRepo,
    ISubscriptionRepository       subRepo,
    ISubscriptionAccessCache      accessCache,
    IEnumerable<IBillingProvider> providers,
    IUnitOfWork                   uow,
    IOptionsSnapshot<BillingOptions>      options,
    ILogger<HandlePayPalWebhookCommandHandler> logger)
    : ICommandHandler<HandlePayPalWebhookCommand>
{
    public async Task<Result> Handle(HandlePayPalWebhookCommand cmd, CancellationToken ct)
    {
        var paypal = providers.OfType<PayPalBillingProvider>().FirstOrDefault();
        if (paypal is null || !paypal.IsConfigured)
            return Result.Failure(Error.Custom("Billing.PayPal.NotConfigured", "PayPal is not configured on this server."));

        if (!await paypal.VerifyWebhookAsync(cmd.Headers, cmd.RawBody, ct))
            return Result.Failure(Error.Custom("Billing.PayPal.BadSignature", "Invalid webhook signature."));

        using var doc = JsonDocument.Parse(cmd.RawBody);
        var root      = doc.RootElement;

        var eventId   = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var eventType = root.TryGetProperty("event_type", out var typeEl) ? typeEl.GetString() : null;

        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(eventType))
            return Result.Failure(Error.Custom("Billing.PayPal.BadPayload", "Webhook payload is missing id or event_type."));

        // ── Idempotency ──────────────────────────────────────────────────────
        if (await subRepo.WebhookEventExistsAsync(PaymentProvider.PayPal, eventId, ct))
        {
            logger.LogInformation("PayPal event {EventId} ({Type}) already processed — acknowledging without re-applying.",
                eventId, eventType);
            return Result.Success();
        }

        var record = new BillingWebhookEvent(PaymentProvider.PayPal, eventId, eventType, cmd.RawBody);
        subRepo.AddWebhookEvent(record);

        try
        {
            await ApplyAsync(eventType, root, ct);
            record.MarkProcessed();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to apply PayPal event {EventId} ({Type}).", eventId, eventType);
            record.MarkFailed(ex.ToString());
            await uow.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("Billing.PayPal.ApplyFailed", "Failed to process the webhook."));
        }

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task ApplyAsync(string eventType, JsonElement root, CancellationToken ct)
    {
        var resource = root.TryGetProperty("resource", out var r) ? r : default;
        if (resource.ValueKind != JsonValueKind.Object)
        {
            logger.LogDebug("PayPal event {Type} has no resource object; ignoring.", eventType);
            return;
        }

        switch (eventType)
        {
            case "BILLING.SUBSCRIPTION.ACTIVATED":
            case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
                await OnActivated(resource, ct);
                break;

            case "BILLING.SUBSCRIPTION.CANCELLED":
            case "BILLING.SUBSCRIPTION.EXPIRED":
                await OnEnded(resource, ct);
                break;

            case "BILLING.SUBSCRIPTION.SUSPENDED":
            case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
                await OnPaymentTrouble(resource, ct);
                break;

            case "PAYMENT.SALE.COMPLETED":
                await OnSaleCompleted(resource, ct);
                break;

            default:
                logger.LogDebug("Ignoring unhandled PayPal event type {Type}.", eventType);
                break;
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private async Task OnActivated(JsonElement resource, CancellationToken ct)
    {
        var subscriptionId = Str(resource, "id");
        var subscription   = await ResolveAsync(resource, subscriptionId, ct);
        if (subscription is null) return;

        subscription.LinkProvider(Str(resource, "subscriber", "payer_id"), subscriptionId);

        var periodEnd = DateTimeOrNull(resource, "billing_info", "next_billing_time");
        subscription.Activate(DateTime.UtcNow, periodEnd);

        var tenant = await tenantRepo.GetByIdAsync(subscription.TenantId, ct);
        if (tenant is not null)
        {
            tenant.ActivatePaid(subscription.Plan, periodEnd);
            accessCache.Invalidate(tenant.Id);
        }

        logger.LogInformation("PayPal subscription {SubId} activated for tenant {TenantId}.",
            subscriptionId, subscription.TenantId);
    }

    private async Task OnEnded(JsonElement resource, CancellationToken ct)
    {
        var subscription = await ResolveAsync(resource, Str(resource, "id"), ct);
        if (subscription is null) return;

        subscription.Expire();

        // Access is gated; the tenant's data stays exactly as it is and returns on resubscribe.
        var tenant = await tenantRepo.GetByIdAsync(subscription.TenantId, ct);
        if (tenant is not null)
        {
            tenant.Expire();
            accessCache.Invalidate(tenant.Id);
        }
    }

    private async Task OnPaymentTrouble(JsonElement resource, CancellationToken ct)
    {
        var subscription = await ResolveAsync(resource, Str(resource, "id"), ct);
        if (subscription is null) return;

        // Keep access while PayPal retries — same dunning posture as Stripe's past_due.
        subscription.MarkPastDue();
        logger.LogWarning("PayPal payment trouble for tenant {TenantId}; subscription marked past due.",
            subscription.TenantId);
    }

    private async Task OnSaleCompleted(JsonElement resource, CancellationToken ct)
    {
        // Sale events reference the subscription through billing_agreement_id.
        var agreementId = Str(resource, "billing_agreement_id");
        if (string.IsNullOrWhiteSpace(agreementId)) return;

        var subscription = await subRepo.GetByProviderSubscriptionIdAsync(agreementId, ct);
        if (subscription is null)
        {
            logger.LogWarning("PayPal sale references unknown subscription {AgreementId}.", agreementId);
            return;
        }

        var saleId = Str(resource, "id");
        if (string.IsNullOrWhiteSpace(saleId)) return;

        if (await subRepo.GetInvoiceAsync(PaymentProvider.PayPal, saleId, ct) is { } existing)
        {
            existing.MarkPaid(DateTime.UtcNow);
            return;
        }

        var amount   = DecimalOrZero(resource, "amount", "total");
        var currency = Str(resource, "amount", "currency") ?? options.Value.Currency;

        var invoice = new SubscriptionInvoice(
            subscription.Id, subscription.TenantId, PaymentProvider.PayPal, saleId,
            amount, currency.ToUpperInvariant(), InvoiceStatus.Paid);
        invoice.MarkPaid(DateTime.UtcNow);
        subRepo.AddInvoice(invoice);

        // A completed sale clears a past-due state and restores access.
        if (subscription.Status is SubscriptionStatus.PastDue or SubscriptionStatus.Incomplete)
        {
            subscription.Activate(DateTime.UtcNow, subscription.CurrentPeriodEnd);
            var tenant = await tenantRepo.GetByIdAsync(subscription.TenantId, ct);
            if (tenant is not null)
            {
                tenant.ActivatePaid(subscription.Plan, subscription.CurrentPeriodEnd);
                accessCache.Invalidate(tenant.Id);
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Find our subscription for a PayPal resource: by provider subscription id first, then by the
    /// <c>custom_id</c> we stamped with the tenant id at creation.
    /// </summary>
    private async Task<Subscription?> ResolveAsync(JsonElement resource, string? subscriptionId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(subscriptionId))
        {
            var bySub = await subRepo.GetByProviderSubscriptionIdAsync(subscriptionId, ct);
            if (bySub is not null) return bySub;
        }

        var customId = Str(resource, "custom_id");
        if (Guid.TryParse(customId, out var tenantId))
        {
            var byTenant = await subRepo.GetByTenantAsync(tenantId, ct);
            if (byTenant is not null)
            {
                byTenant.LinkProvider(null, subscriptionId);
                return byTenant;
            }
        }

        logger.LogWarning("PayPal resource {SubId} could not be matched to a subscription.", subscriptionId);
        return null;
    }

    private static string? Str(JsonElement el, params string[] path)
    {
        var current = el;
        foreach (var key in path)
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(key, out current))
                return null;
        }
        return current.ValueKind == JsonValueKind.String ? current.GetString() : null;
    }

    private static decimal DecimalOrZero(JsonElement el, params string[] path)
    {
        var raw = Str(el, path);
        return decimal.TryParse(raw, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var value) ? value : 0m;
    }

    private static DateTime? DateTimeOrNull(JsonElement el, params string[] path)
    {
        var raw = Str(el, path);
        return DateTime.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal,
            out var value) ? value : null;
    }
}
