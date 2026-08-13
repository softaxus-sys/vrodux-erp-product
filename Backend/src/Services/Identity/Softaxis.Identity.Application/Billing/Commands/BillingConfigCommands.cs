using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Application.Billing.Commands;

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Effective billing configuration for the super-admin screen: the env-bound options with the
/// saved overrides already applied (the options overlay does that), plus per-provider status so
/// the admin can tell "switched off" from "switched on but missing its secret".
/// </summary>
public sealed record GetBillingConfigQuery : IQuery<BillingConfigDto>;

public sealed class GetBillingConfigQueryHandler(
    IOptionsSnapshot<BillingOptions> options,
    IBillingSettingsStore            store)
    : IQueryHandler<GetBillingConfigQuery, BillingConfigDto>
{
    public async Task<Result<BillingConfigDto>> Handle(GetBillingConfigQuery query, CancellationToken ct)
    {
        // options.Value already has the saved row overlaid (BillingOptionsDbOverlay); the row is
        // fetched only for the "last changed by/when" line.
        var row = await store.GetAsync(ct);
        return Result.Success(BillingConfigMapping.Build(options.Value, row));
    }
}

internal static class BillingConfigMapping
{
    /// <summary>
    /// Builds the screen's view of the config. <paramref name="options"/> supplies the env half
    /// (secrets presence, public base url) and the effective values; <paramref name="row"/> is
    /// passed separately so a just-saved config isn't reported from a stale per-scope snapshot.
    /// </summary>
    public static BillingConfigDto Build(BillingOptions options, Domain.Entities.BillingSettings? row)
    {
        var stripeHasSecret = !string.IsNullOrWhiteSpace(options.Stripe.SecretKey);
        var payPalHasSecret = !string.IsNullOrWhiteSpace(options.PayPal.ClientId)
                           && !string.IsNullOrWhiteSpace(options.PayPal.ClientSecret);

        var stripeEnabled = row?.StripeEnabled    ?? options.Stripe.Enabled;
        var payPalEnabled = row?.PayPalEnabled    ?? options.PayPal.Enabled;
        var sandbox       = row?.PayPalUseSandbox ?? options.PayPal.UseSandbox;

        IReadOnlyDictionary<string, string> stripeIds =
            row is { StripePrices.Count: > 0 } ? row.StripePrices : options.Stripe.Prices;
        IReadOnlyDictionary<string, string> payPalIds =
            row is { PayPalPlans.Count: > 0 } ? row.PayPalPlans : options.PayPal.Plans;

        return new BillingConfigDto(
            Currency:      row?.Currency ?? options.Currency,
            PublicBaseUrl: options.PublicBaseUrl,
            Stripe: new BillingProviderConfigDto(
                Enabled:    stripeEnabled,
                HasSecret:  stripeHasSecret,
                UseSandbox: null,                      // Stripe's test/live split is the key itself
                Ids:        stripeIds,
                IsUsable:   stripeEnabled && stripeHasSecret && stripeIds.Count > 0),
            PayPal: new BillingProviderConfigDto(
                Enabled:    payPalEnabled,
                HasSecret:  payPalHasSecret,
                UseSandbox: sandbox,
                Ids:        payPalIds,
                IsUsable:   payPalEnabled && payPalHasSecret && payPalIds.Count > 0),
            UpdatedAt: row?.UpdatedAt,
            UpdatedBy: row?.UpdatedBy);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Save the operational half of the billing config. Carries no secrets by design — see
/// <see cref="Domain.Entities.BillingSettings"/> for why those stay in the environment.
/// </summary>
public sealed record UpdateBillingConfigCommand(
    string?                     Currency,
    bool                        StripeEnabled,
    Dictionary<string, string>? StripePrices,
    bool                        PayPalEnabled,
    bool                        PayPalUseSandbox,
    Dictionary<string, string>? PayPalPlans,
    string?                     UpdatedBy) : ICommand<BillingConfigDto>;

public sealed class UpdateBillingConfigCommandHandler(
    IBillingSettingsStore            store,
    IOptionsSnapshot<BillingOptions> options)
    : ICommandHandler<UpdateBillingConfigCommand, BillingConfigDto>
{
    public async Task<Result<BillingConfigDto>> Handle(UpdateBillingConfigCommand cmd, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(cmd.Currency) && cmd.Currency.Trim().Length != 3)
            return Result.Failure<BillingConfigDto>(Error.Custom(
                "Billing.Config.Invalid", "Currency must be a 3-letter ISO code, e.g. USD."));

        await store.SaveAsync(
            cmd.StripeEnabled, cmd.StripePrices ?? [],
            cmd.PayPalEnabled, cmd.PayPalUseSandbox, cmd.PayPalPlans ?? [],
            cmd.Currency, cmd.UpdatedBy, ct);

        // Respond with the saved row overlaid on the env options, not an echo of the request: the
        // screen must show the same effective config the checkout path will use, including the
        // fields where the environment still wins. Save invalidated the cache, so this re-reads.
        var saved = await store.GetAsync(ct);

        // options.Value was built for this scope BEFORE the save, so the overlay in it is stale —
        // BillingConfigMapping takes the row explicitly rather than trusting the snapshot.
        return Result.Success(BillingConfigMapping.Build(options.Value, saved));
    }
}
