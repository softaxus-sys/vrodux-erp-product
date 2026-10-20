namespace Softaxis.BuildingBlocks.Domain.Multitenancy;

/// <summary>
/// Per-plan object-storage budget (in GB), against the shared bucket's provisioned capacity.
///
/// Single source of truth, deliberately placed in BuildingBlocks rather than Identity's own
/// <c>PlanDefinitions</c>: Identity resolves it from here too (it already references
/// BuildingBlocks.Domain), and the four services that actually write to the bucket (HR, CRM,
/// Support, RealEstate) enforce it at upload time without taking a dependency on Identity —
/// they only ever see the tenant's <c>Plan</c> as a bare string (read via cross-schema SQL, same
/// as every other cross-service tenant lookup in this codebase), which is why this is keyed by
/// plan name rather than Identity's <c>PlanType</c> enum.
/// </summary>
public static class PlanStorageLimits
{
    /// <summary>Returned by <see cref="GbFor"/> for a plan with no cap — Enterprise, sales-quoted
    /// and handled case by case, same as its unlimited seat/warehouse/branch limits.</summary>
    public const int Unlimited = -1;

    private static readonly IReadOnlyDictionary<string, int> GbByPlan =
        new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Micro"]        = 5,
            ["Starter"]      = 10,
            ["Professional"] = 25,
            ["Enterprise"]   = Unlimited,
        };

    /// <summary>GB included in the given plan name. An unrecognised/legacy name falls back to
    /// Micro's limit — same conservative default <c>PlanDefinitions.Parse</c> uses.</summary>
    public static int GbFor(string? planName) =>
        planName is not null && GbByPlan.TryGetValue(planName.Trim(), out var gb) ? gb : GbByPlan["Micro"];

    /// <summary>GB converted to bytes, or <see cref="long.MaxValue"/> for unlimited — so a plain
    /// "used &lt;= budget" comparison works everywhere without a separate unlimited branch.</summary>
    public static long BudgetBytesFor(string? planName)
    {
        var gb = GbFor(planName);
        return gb == Unlimited ? long.MaxValue : (long)gb * 1024 * 1024 * 1024;
    }
}
