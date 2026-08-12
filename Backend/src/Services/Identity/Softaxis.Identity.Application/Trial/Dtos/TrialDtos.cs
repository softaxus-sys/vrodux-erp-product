namespace Softaxis.Identity.Application.Trial.Dtos;

public sealed record TrialChallengeDto(string Token);

public sealed record TrialRegistrationResultDto(
    Guid      TenantId,
    string    TenantSlug,
    Guid      UserId,
    string    Email,
    DateTime? TrialEndsAt,
    /// <summary>Tier the tenant was created on, echoed back so the UI can confirm it.</summary>
    string?   Plan             = null,
    /// <summary>
    /// True when the signup came from a "Buy Now" pricing-page link (<c>intent=buy</c>) — the
    /// frontend should send the user straight to checkout instead of into the app.
    /// The tenant is still created on a trial; only a confirmed payment webhook activates it.
    /// </summary>
    bool      CheckoutRequested = false,
    /// <summary>Billing cadence pre-selected on the pricing page ("monthly" | "annual").</summary>
    string?   BillingPeriod    = null);
