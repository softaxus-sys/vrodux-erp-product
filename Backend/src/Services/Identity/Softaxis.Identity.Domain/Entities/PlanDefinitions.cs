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
    IReadOnlyList<string> Modules);

/// <summary>
/// Static plan catalogue — source of truth for limit enforcement.
/// </summary>
public static class PlanDefinitions
{
    private static readonly IReadOnlyList<string> StarterModules =
    [
        "pos", "inventory.basic", "reports.basic", "settings",
    ];

    private static readonly IReadOnlyList<string> BusinessModules =
    [
        "pos", "inventory", "purchasing", "reports", "settings",
        "hr.basic", "crm.basic", "sales",
    ];

    private static readonly IReadOnlyList<string> EnterpriseModules =
    [
        "pos", "inventory", "purchasing", "reports", "settings",
        "hr", "crm", "finance", "manufacturing", "api", "custom-reports", "sales",
    ];

    public static readonly IReadOnlyDictionary<PlanType, PlanLimits> All =
        new Dictionary<PlanType, PlanLimits>
        {
            [PlanType.Starter] = new(
                MaxUsers:       3,
                MaxWarehouses:  1,
                MaxBranches:    1,
                MultiCurrency:  false,
                ApiAccess:      false,
                CustomReports:  false,
                WhiteLabel:     false,
                Modules:        StarterModules),

            [PlanType.Business] = new(
                MaxUsers:       15,
                MaxWarehouses:  3,
                MaxBranches:    3,
                MultiCurrency:  false,
                ApiAccess:      false,
                CustomReports:  false,
                WhiteLabel:     true,
                Modules:        BusinessModules),

            [PlanType.Enterprise] = new(
                MaxUsers:       -1,
                MaxWarehouses:  -1,
                MaxBranches:    -1,
                MultiCurrency:  true,
                ApiAccess:      true,
                CustomReports:  true,
                WhiteLabel:     true,
                Modules:        EnterpriseModules),
        };

    public static PlanLimits Get(string planName) =>
        Enum.TryParse<PlanType>(planName, ignoreCase: true, out var plan) && All.TryGetValue(plan, out var limits)
            ? limits
            : All[PlanType.Starter];

    public static PlanLimits Get(PlanType plan) =>
        All.TryGetValue(plan, out var limits) ? limits : All[PlanType.Starter];
}
