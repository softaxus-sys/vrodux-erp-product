namespace Softaxis.Identity.Application.Billing.Dtos;

/// <summary>What the billing page renders: current state + what can be bought.</summary>
public sealed record BillingOverviewDto(
    // ── Tenant state ──
    Guid      TenantId,
    string    TenantName,
    string    Plan,
    string    PlanLabel,
    string    TenantStatus,
    DateTime? TrialEndsAt,
    int?      TrialDaysRemaining,
    /// <summary>False once the trial lapses or the account is suspended — the UI shows the reactivate screen.</summary>
    bool      HasProductAccess,
    /// <summary>
    /// True only for a "Buy Now" signup that never paid and has never had a trial — the billing page
    /// offers "start a 30-day trial instead" so an abandoned checkout isn't a dead account.
    /// </summary>
    bool      CanStartTrial,

    // ── Seats ──
    int       UsersInUse,
    int       MaxUsers,          // -1 = unlimited

    // ── Subscription (null until the tenant has ever checked out) ──
    SubscriptionDto? Subscription,

    // ── Catalogue ──
    IReadOnlyList<PlanOptionDto> Plans,
    /// <summary>Providers actually configured on the server, so the UI only offers what will work.</summary>
    IReadOnlyList<string> AvailableProviders);

public sealed record SubscriptionDto(
    Guid      Id,
    string    Plan,
    string    BillingPeriod,
    string    Status,
    string    Provider,
    decimal   Amount,
    string    Currency,
    DateTime? CurrentPeriodStart,
    DateTime? CurrentPeriodEnd,
    bool      CancelAtPeriodEnd,
    DateTime? CanceledAt,
    /// <summary>True while this subscription still entitles the tenant to use the product.</summary>
    bool      GrantsAccess);

public sealed record PlanOptionDto(
    string   Id,
    string   Name,
    string   Label,
    decimal? MonthlyUsd,
    decimal? AnnualUsdPerMonth,
    decimal? AnnualUsdTotal,
    int      MaxUsers,
    bool     SelfServe,
    bool     IsCurrent,
    IReadOnlyList<string> Modules);

public sealed record InvoiceDto(
    Guid      Id,
    string    Provider,
    string    ProviderInvoiceId,
    decimal   Amount,
    string    Currency,
    string    Status,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    DateTime? PaidAt,
    string?   HostedInvoiceUrl,
    string?   InvoicePdfUrl,
    DateTime  CreatedAt);

/// <summary>Where to send the browser to complete payment.</summary>
public sealed record CheckoutSessionDto(string RedirectUrl, string Provider);
