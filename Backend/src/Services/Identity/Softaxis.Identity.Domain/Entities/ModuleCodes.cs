namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// String constants for every module code used in plan definitions, JWT claims,
/// and the module-enforcement middleware's route map.
/// </summary>
public static class ModuleCodes
{
    // ── POS / Retail ─────────────────────────────────────────────────────────
    public const string Pos = "pos";

    // ── Inventory ────────────────────────────────────────────────────────────
    public const string InventoryBasic = "inventory.basic";
    public const string Inventory      = "inventory";

    // ── Purchasing ───────────────────────────────────────────────────────────
    public const string Purchasing = "purchasing";

    // ── Reports ──────────────────────────────────────────────────────────────
    public const string ReportsBasic  = "reports.basic";
    public const string Reports        = "reports";
    public const string CustomReports  = "custom-reports";

    // ── Settings ─────────────────────────────────────────────────────────────
    public const string Settings = "settings";

    // ── HR ───────────────────────────────────────────────────────────────────
    public const string HrBasic = "hr.basic";
    public const string Hr      = "hr";

    // ── CRM ──────────────────────────────────────────────────────────────────
    public const string CrmBasic = "crm.basic";
    public const string Crm      = "crm";

    // ── Sales ────────────────────────────────────────────────────────────────
    public const string Sales = "sales";

    // ── Finance ──────────────────────────────────────────────────────────────
    public const string Finance = "finance";

    // ── Manufacturing / Construction ─────────────────────────────────────────
    public const string Manufacturing = "manufacturing";

    // ── Project Management ───────────────────────────────────────────────────
    public const string ProjectManagement = "project-management";

    // ── Hospitality ──────────────────────────────────────────────────────────
    public const string Hospitality = "hospitality";

    // ── Visa Services ────────────────────────────────────────────────────────
    public const string Visa = "visa";

    // ── Industry Packs (activated by tenant.Industry) ─────────────────────────
    public const string RealEstate   = "real-estate";
    public const string Construction = "construction";
    public const string Healthcare   = "healthcare";
    public const string Education    = "education";
    public const string Insurance    = "insurance";
    public const string B2B          = "b2b";

    // ── API access ───────────────────────────────────────────────────────────
    public const string Api = "api";

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns true if <paramref name="tenantModule"/> satisfies the
    /// <paramref name="requiredModule"/> access level.
    ///
    /// A "parent" module satisfies all ".basic" sub-variants:
    ///   "inventory" satisfies "inventory.basic"
    ///   "hr"        satisfies "hr.basic"
    ///   "crm"       satisfies "crm.basic"
    ///
    /// The reverse is NOT true: having "inventory.basic" does NOT satisfy "inventory".
    /// </summary>
    public static bool Satisfies(string tenantModule, string requiredModule) =>
        tenantModule == requiredModule ||
        requiredModule.StartsWith(tenantModule + ".", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Returns true if the <paramref name="tenantModules"/> collection contains
    /// at least one module that satisfies <paramref name="requiredModule"/>.
    /// </summary>
    public static bool HasAccess(IEnumerable<string> tenantModules, string requiredModule) =>
        tenantModules.Any(m => Satisfies(m, requiredModule));
}
