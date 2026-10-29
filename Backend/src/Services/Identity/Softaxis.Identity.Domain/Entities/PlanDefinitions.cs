using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Immutable plan limits. -1 = unlimited.
/// </summary>
public sealed record PlanLimits(
    int MaxUsers,
    int MaxWarehouses,
    int MaxBranches,
    bool MultiCurrency,
    bool ApiAccess,
    bool CustomReports,
    bool WhiteLabel,
    IReadOnlyList<string> Modules,
    int StorageGb); // GB in the shared object-storage bucket. -1 = unlimited.

/// <summary>
/// List price in USD. <see cref="MonthlyUsd"/> is the month-to-month rate;
/// <see cref="AnnualUsdPerMonth"/> is the discounted rate when billed annually, and
/// <see cref="AnnualUsdTotal"/> is what actually gets charged once per year.
/// Null on Enterprise — that tier is quoted by sales, never self-serve.
/// </summary>
public sealed record PlanPricing(decimal? MonthlyUsd, decimal? AnnualUsdPerMonth)
{
    public decimal? AnnualUsdTotal => AnnualUsdPerMonth * 12m;

    /// <summary>Amount charged per billing cycle for the given period.</summary>
    public decimal? AmountFor(BillingPeriod period) =>
        period == BillingPeriod.Annual ? AnnualUsdTotal : MonthlyUsd;
}

/// <summary>
/// Static plan catalogue — the source of truth for limit + module entitlement.
/// Mirrors vrodux.com/pricing; keep the two in step.
/// </summary>
public static class PlanDefinitions
{
    /// <summary>
    /// <b>Every module is available on every tier.</b> Price is set by the number of users and
    /// nothing else — a customer picks whichever modules they need (or all of them) and pays for
    /// seats, not features. These are real <c>ModuleKey</c> values (see the frontend
    /// <c>types/global.ts</c> union).
    ///
    /// <para>The tenant's own selection (made at signup, changeable by a super admin) still narrows
    /// what they see — this list is only the ceiling, and it is now the whole catalogue.</para>
    ///
    /// <para>The AI assistant is bring-your-own-key: the tenant supplies their own provider
    /// credentials, so it costs us nothing and is included everywhere.</para>
    /// </summary>
    public static readonly IReadOnlyList<string> AllModules =
    [
        "dashboard", "crm", "sales", "purchase", "inventory",
        "finance", "hr", "reports", "settings", "users",
        "notifications", "file-manager", "project-management", "ai-assistant",
        "pos", "restaurant", "recipe", "hospitality",
        "real-estate", "construction", "healthcare", "education", "insurance", "b2b", "visa",
        "manufacturing", "library", "trade", "leadgen", "ecommerce",
    ];

    public static readonly IReadOnlyDictionary<PlanType, PlanLimits> All =
        new Dictionary<PlanType, PlanLimits>
        {
            [PlanType.Micro] = new(
                MaxUsers:       3,
                MaxWarehouses:  1,
                MaxBranches:    1,
                MultiCurrency:  false,
                ApiAccess:      false,
                CustomReports:  false,
                WhiteLabel:     false,
                Modules:        AllModules,
                StorageGb:      PlanStorageLimits.GbFor(nameof(PlanType.Micro))),

            [PlanType.Starter] = new(
                MaxUsers:       10,
                MaxWarehouses:  2,
                MaxBranches:    1,
                MultiCurrency:  false,
                ApiAccess:      false,
                CustomReports:  false,
                WhiteLabel:     false,
                Modules:        AllModules,
                StorageGb:      PlanStorageLimits.GbFor(nameof(PlanType.Starter))),

            [PlanType.Professional] = new(
                MaxUsers:       50,
                MaxWarehouses:  10,
                MaxBranches:    3,      // "Multi-company (up to 3)"
                MultiCurrency:  true,
                ApiAccess:      true,
                CustomReports:  true,
                WhiteLabel:     true,
                Modules:        AllModules,
                StorageGb:      PlanStorageLimits.GbFor(nameof(PlanType.Professional))),

            [PlanType.Enterprise] = new(
                MaxUsers:       -1,
                MaxWarehouses:  -1,
                MaxBranches:    -1,
                MultiCurrency:  true,
                ApiAccess:      true,
                CustomReports:  true,
                WhiteLabel:     true,
                Modules:        AllModules,
                StorageGb:      PlanStorageLimits.GbFor(nameof(PlanType.Enterprise))),
        };

    public static readonly IReadOnlyDictionary<PlanType, PlanPricing> Pricing =
        new Dictionary<PlanType, PlanPricing>
        {
            [PlanType.Micro]        = new(MonthlyUsd: 159m, AnnualUsdPerMonth: 129m),
            [PlanType.Starter]      = new(MonthlyUsd: 299m, AnnualUsdPerMonth: 249m),
            [PlanType.Professional] = new(MonthlyUsd: 849m, AnnualUsdPerMonth: 699m),
            [PlanType.Enterprise]   = new(MonthlyUsd: null, AnnualUsdPerMonth: null),
        };

    /// <summary>Tiers a tenant can buy without talking to sales.</summary>
    public static readonly IReadOnlyList<PlanType> SelfServePlans =
        [PlanType.Micro, PlanType.Starter, PlanType.Professional];

    /// <summary>
    /// Legacy plan names that may still exist on rows written before
    /// <c>RenameLegacyPlanNames</c>. Defensive net only: if that data migration ever fails or is
    /// partially applied, "Business" would otherwise fail to parse and silently collapse to the
    /// fallback tier, quietly changing a paying tenant's limits.
    /// </summary>
    private static readonly Dictionary<string, PlanType> LegacyAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Business"] = PlanType.Professional,   // legacy Business (15 users) → Professional (50)
    };

    public static PlanLimits Get(PlanType plan) =>
        All.TryGetValue(plan, out var limits) ? limits : All[PlanType.Micro];

    public static PlanPricing PriceOf(PlanType plan) =>
        Pricing.TryGetValue(plan, out var p) ? p : Pricing[PlanType.Micro];

    /// <summary>Parse a stored/queried plan name, tolerating legacy values. Unknown → Micro (lowest tier).</summary>
    public static PlanType Parse(string? planName)
    {
        if (string.IsNullOrWhiteSpace(planName)) return PlanType.Micro;
        if (Enum.TryParse<PlanType>(planName, ignoreCase: true, out var plan) && All.ContainsKey(plan))
            return plan;
        return LegacyAliases.TryGetValue(planName.Trim(), out var legacy) ? legacy : PlanType.Micro;
    }

    public static PlanLimits Get(string planName) => Get(Parse(planName));
}
