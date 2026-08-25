namespace Softaxis.Identity.Application.Seed;

/// <summary>
/// One default role a tenant gets for an enabled module. <see cref="Includes"/> is given a
/// permission's <c>ModuleId</c> and <c>Action</c> and decides whether the role grants it, so a
/// template never has to name individual permission ids — new permissions added to
/// <see cref="PermissionSeedData"/> flow into the matching roles automatically.
/// </summary>
public sealed record ModuleRoleTemplate(string Name, string Description, Func<string, string, bool> Includes);

/// <summary>
/// The default roles provisioned per module. Every module gets a Manager (everything in that
/// module) plus a narrower operational role, so a tenant starts with a usable hierarchy instead of
/// a single all-or-nothing Administrator.
///
/// CRM is the one module with a genuine three-tier model, because its records carry an owner and
/// the access guard understands <c>-team</c> / <c>-assigned</c> permission keys. Elsewhere the
/// distinction is capability-based (a Staff role that cannot delete or approve), since those
/// modules have no per-record ownership to scope by — inventing "my records only" roles there
/// would grant nothing the guard could honour.
/// </summary>
public static class ModuleRoleCatalogue
{
    /// <summary>Actions reserved for a manager — destructive, financial or approval authority.</summary>
    private static readonly HashSet<string> PrivilegedActions =
        new(StringComparer.OrdinalIgnoreCase) { "delete", "approve", "void", "refund", "discount", "create-login" };

    /// <summary>Display label per module prefix. A module absent here gets no default roles.</summary>
    public static readonly IReadOnlyDictionary<string, string> ModuleLabels =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["crm"]                = "CRM",
            ["sales"]              = "Sales",
            ["purchase"]           = "Purchase",
            ["finance"]            = "Finance",
            ["hr"]                 = "HR",
            ["inventory"]          = "Inventory",
            ["pos"]                = "POS",
            ["project-management"] = "Project",
            ["b2b"]                = "B2B",
            ["education"]          = "Education",
            ["healthcare"]         = "Healthcare",
            ["insurance"]          = "Insurance",
            ["visa"]               = "Visa",
            ["restaurant"]         = "Restaurant",
        };

    /// <summary>True when a permission belongs to <paramref name="module"/> (its first dotted segment).</summary>
    private static bool InModule(string moduleId, string module) =>
        string.Equals(moduleId.Split('.')[0], module, StringComparison.OrdinalIgnoreCase);

    /// <summary>The tier suffix of a CRM key: "crm.leads-team" → "team", "crm.leads" → "".</summary>
    private static string TierOf(string moduleId)
    {
        var last = moduleId.Split('.').Last();
        var dash = last.LastIndexOf('-');
        return dash < 0 ? string.Empty : last[(dash + 1)..];
    }

    /// <summary>Default roles for a module, or empty when the module has none defined.</summary>
    public static IReadOnlyList<ModuleRoleTemplate> For(string module)
    {
        if (!ModuleLabels.TryGetValue(module, out var label)) return [];

        // ── CRM: the full ownership hierarchy ───────────────────────────────
        if (string.Equals(module, "crm", StringComparison.OrdinalIgnoreCase))
            return
            [
                new($"{label} Manager",
                    "Full access to every CRM record in the tenant.",
                    (m, _) => InModule(m, "crm") && TierOf(m).Length == 0),

                new($"{label} Team Lead",
                    "Sees and manages their own records plus those owned by their team members.",
                    (m, a) => InModule(m, "crm") &&
                              (TierOf(m) == "team" || (TierOf(m).Length == 0 && a == "create"))),

                new($"{label} Agent",
                    "Sees and manages only the records assigned to them.",
                    (m, a) => InModule(m, "crm") &&
                              (TierOf(m) == "assigned" || (TierOf(m).Length == 0 && a == "create"))),
            ];

        // ── POS: shift-based operational tiers ──────────────────────────────
        if (string.Equals(module, "pos", StringComparison.OrdinalIgnoreCase))
            return
            [
                new($"{label} Manager", "Full access to point of sale.", (m, _) => InModule(m, "pos")),

                new("Supervisor",
                    "Full POS operations — open/close shifts, void transactions, apply discounts, manage refunds.",
                    (m, a) => InModule(m, "pos") && a != "delete"),

                new("Cashier",
                    "Process sales at the POS terminal. View products and print receipts.",
                    (m, a) => m is "pos.sessions" or "pos.products" ? a == "view"
                            : m == "pos.transactions" && a is "view" or "create" or "print"),
            ];

        // ── HR: manager + staff, plus the self-service tier ─────────────────
        if (string.Equals(module, "hr", StringComparison.OrdinalIgnoreCase))
            return
            [
                new($"{label} Manager", $"Full access to the {label} module.", (m, _) => InModule(m, "hr")),

                new($"{label} Staff",
                    "Day-to-day HR work — can view and record, but not delete or approve.",
                    (m, a) => InModule(m, "hr") && !PrivilegedActions.Contains(a)),

                // The role given to ordinary staff so they can book leave, mark attendance and
                // see their own payslips — and nothing else. Holds hr.self.* exclusively.
                new("Employee (Self-Service)",
                    "See your own employee record, apply for leave, mark attendance and download your payslips.",
                    (m, _) => string.Equals(m, "hr.self", StringComparison.OrdinalIgnoreCase)),
            ];

        // ── Everything else: manager + day-to-day staff ─────────────────────
        return
        [
            new($"{label} Manager", $"Full access to the {label} module.", (m, _) => InModule(m, module)),

            new($"{label} Staff",
                $"Day-to-day {label} work — can view and record, but not delete or approve.",
                (m, a) => InModule(m, module) && !PrivilegedActions.Contains(a)),
        ];
    }
}
