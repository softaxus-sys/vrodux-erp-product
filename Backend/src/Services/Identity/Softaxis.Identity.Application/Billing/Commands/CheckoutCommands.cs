using FluentValidation;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing.Dtos;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Billing.Commands;

// ─────────────────────────────────────────────────────────────────────────────
// Start a purchase
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Begin checkout for a tier. Returns the provider URL to redirect the browser to.</summary>
public sealed record CreateCheckoutSessionCommand(
    string Plan,
    string BillingPeriod,
    string Provider) : ICommand<CheckoutSessionDto>;

public sealed class CreateCheckoutSessionValidator : AbstractValidator<CreateCheckoutSessionCommand>
{
    public CreateCheckoutSessionValidator()
    {
        RuleFor(x => x.Plan).NotEmpty();
        RuleFor(x => x.BillingPeriod).NotEmpty();
        RuleFor(x => x.Provider).NotEmpty();
    }
}

public sealed class CreateCheckoutSessionCommandHandler(
    ITenantContext                tenantCtx,
    ITenantRepository             tenantRepo,
    ISubscriptionRepository       subRepo,
    IEnumerable<IBillingProvider> providers,
    IOptionsSnapshot<BillingOptions>      options,
    IUnitOfWork                   uow)
    : ICommandHandler<CreateCheckoutSessionCommand, CheckoutSessionDto>
{
    public async Task<Result<CheckoutSessionDto>> Handle(CreateCheckoutSessionCommand cmd, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure<CheckoutSessionDto>(Error.Custom("Billing.NoTenant", "Billing is only available to tenant accounts."));

        var tenant = await tenantRepo.GetByIdAsync(tenantCtx.TenantId.Value, ct);
        if (tenant is null)
            return Result.Failure<CheckoutSessionDto>(Error.NotFoundById(nameof(Tenant), tenantCtx.TenantId.Value));

        if (!Enum.TryParse<PlanType>(cmd.Plan, ignoreCase: true, out var plan))
            return Result.Failure<CheckoutSessionDto>(Error.Custom("Billing.UnknownPlan", $"Unknown plan '{cmd.Plan}'."));

        // Enterprise is negotiated, never self-serve — otherwise a crafted request could buy
        // unlimited seats at whatever price happened to be configured.
        if (!PlanDefinitions.SelfServePlans.Contains(plan))
            return Result.Failure<CheckoutSessionDto>(Error.Custom(
                "Billing.NotSelfServe",
                "The Enterprise plan is arranged with our sales team. Please contact us for a quote."));

        if (!Enum.TryParse<BillingPeriod>(cmd.BillingPeriod, ignoreCase: true, out var period))
            return Result.Failure<CheckoutSessionDto>(Error.Custom("Billing.UnknownPeriod", $"Unknown billing period '{cmd.BillingPeriod}'."));

        if (!Enum.TryParse<PaymentProvider>(cmd.Provider, ignoreCase: true, out var providerKind))
            return Result.Failure<CheckoutSessionDto>(Error.Custom("Billing.UnknownProvider", $"Unknown payment provider '{cmd.Provider}'."));

        var provider = providers.FirstOrDefault(p => p.Provider == providerKind);
        if (provider is null || !provider.IsConfigured)
            return Result.Failure<CheckoutSessionDto>(Error.Custom(
                "Billing.ProviderUnavailable", $"{providerKind} is not available on this server."));

        var cfg    = options.Value;
        var amount = PlanDefinitions.PriceOf(plan).AmountFor(period) ?? 0m;

        // Track the intended purchase before redirecting. It stays Incomplete until a webhook
        // confirms payment — a browser that never returns simply leaves a stale Incomplete row,
        // never an unpaid activation.
        var subscription = await subRepo.GetByTenantAsync(tenant.Id, ct);
        if (subscription is null)
        {
            subscription = Subscription.Start(tenant.Id, plan, period, providerKind, amount, cfg.Currency);
            subRepo.Add(subscription);
        }
        else
        {
            subscription.ChangePlan(plan, period, amount);
        }

        await uow.SaveChangesAsync(ct);

        // {CHECKOUT_SESSION_ID} is a STRIPE template token — Stripe substitutes it on redirect.
        // PayPal treats the braces as literal URL characters and rejects the entire request with
        // INVALID_PARAMETER_SYNTAX on /application_context/return_url, so it must only ever be
        // appended for Stripe. PayPal adds its own subscription_id/token params on return.
        // The result page reads the outcome from the route and polls our API, so neither provider
        // actually needs anything in the query string.
        var successBase = $"{cfg.PublicBaseUrl.TrimEnd('/')}/billing/checkout/success";
        var successUrl  = providerKind == PaymentProvider.Stripe
            ? $"{successBase}?session={{CHECKOUT_SESSION_ID}}"
            : successBase;
        var cancelUrl   = $"{cfg.PublicBaseUrl.TrimEnd('/')}/billing/checkout/cancelled";

        var url = await provider.CreateCheckoutUrlAsync(tenant, plan, period, successUrl, cancelUrl, ct);
        if (url.IsFailure)
            return Result.Failure<CheckoutSessionDto>(url.Error);

        return Result.Success(new CheckoutSessionDto(url.Value, providerKind.ToString()));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage an existing subscription
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Open the provider's hosted management page (update card, change plan, cancel).</summary>
public sealed record CreatePortalSessionCommand : ICommand<CheckoutSessionDto>;

public sealed class CreatePortalSessionCommandHandler(
    ITenantContext                tenantCtx,
    ISubscriptionRepository       subRepo,
    IEnumerable<IBillingProvider> providers,
    IOptionsSnapshot<BillingOptions>      options)
    : ICommandHandler<CreatePortalSessionCommand, CheckoutSessionDto>
{
    public async Task<Result<CheckoutSessionDto>> Handle(CreatePortalSessionCommand cmd, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure<CheckoutSessionDto>(Error.Custom("Billing.NoTenant", "Billing is only available to tenant accounts."));

        var subscription = await subRepo.GetByTenantAsync(tenantCtx.TenantId.Value, ct);
        if (subscription is null)
            return Result.Failure<CheckoutSessionDto>(Error.Custom(
                "Billing.NoSubscription", "There is no subscription to manage yet."));

        var provider = providers.FirstOrDefault(p => p.Provider == subscription.Provider);
        if (provider is null || !provider.IsConfigured)
            return Result.Failure<CheckoutSessionDto>(Error.Custom(
                "Billing.ProviderUnavailable", $"{subscription.Provider} is not available on this server."));

        var returnUrl = $"{options.Value.PublicBaseUrl.TrimEnd('/')}/settings/billing";

        var url = await provider.CreateManagementUrlAsync(subscription, returnUrl, ct);
        return url.IsFailure
            ? Result.Failure<CheckoutSessionDto>(url.Error)
            : Result.Success(new CheckoutSessionDto(url.Value, subscription.Provider.ToString()));
    }
}

/// <summary>
/// Cancel the subscription. Defaults to end-of-period so the customer keeps what they paid for.
/// </summary>
public sealed record CancelSubscriptionCommand(bool Immediate = false) : ICommand;

public sealed class CancelSubscriptionCommandHandler(
    ITenantContext                tenantCtx,
    ISubscriptionRepository       subRepo,
    IEnumerable<IBillingProvider> providers,
    ISubscriptionAccessCache      accessCache,
    IUnitOfWork                   uow)
    : ICommandHandler<CancelSubscriptionCommand>
{
    public async Task<Result> Handle(CancelSubscriptionCommand cmd, CancellationToken ct)
    {
        if (!tenantCtx.TenantId.HasValue)
            return Result.Failure(Error.Custom("Billing.NoTenant", "Billing is only available to tenant accounts."));

        var subscription = await subRepo.GetByTenantAsync(tenantCtx.TenantId.Value, ct);
        if (subscription is null)
            return Result.Failure(Error.Custom("Billing.NoSubscription", "There is no subscription to cancel."));

        var provider = providers.FirstOrDefault(p => p.Provider == subscription.Provider);

        // Manual/off-platform subscriptions have no provider to call — just record the cancellation.
        if (provider is not null && provider.IsConfigured && subscription.Provider != PaymentProvider.Manual)
        {
            var cancelled = await provider.CancelAsync(subscription, cmd.Immediate, ct);
            if (cancelled.IsFailure) return cancelled;
        }

        subscription.Cancel(cmd.Immediate);
        await uow.SaveChangesAsync(ct);

        // Immediate cancellation revokes access now, so the cached allow-decision must go.
        if (cmd.Immediate) accessCache.Invalidate(subscription.TenantId);

        return Result.Success();
    }
}
