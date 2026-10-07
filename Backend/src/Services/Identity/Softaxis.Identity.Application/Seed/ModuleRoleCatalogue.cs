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
        new(StringComparer.OrdinalIgnoreCase)
        {
            "delete", "approve", "void", "refund", "discount", "create-login", "import", "remind",
            // Confidentiality: a day-to-day "Staff" role must not see a listing's Unit Number /
            // Owner Details by default (that is the whole point of the control) — only the module
            // Manager, the listing's own assigned agent, and whoever is explicitly granted this key.
            "view-confidential",
        };

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
            ["seo"]                = "SEO",
            ["restaurant"]         = "Restaurant",
            ["real-estate"]        = "Real Estate",
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

                // Deliberately no void / refund / discount / approve — those are the Supervisor's.
                // Sessions include "create": a cashier opens and closes their OWN till, which is
                // the whole point of the role. (Handlers still refuse someone else's shift.)
                // Customers are readable so a sale can be attached to one at the till.
                new("Cashier",
                    "Process sales at the POS terminal. Open and close their own shift, view products, print receipts.",
                    (m, a) => m switch
                    {
                        "pos.sessions"     => a is "view" or "create",
                        "pos.products"     => a == "view",
                        "pos.customers"    => a == "view",
                        "pos.transactions" => a is "view" or "create" or "print",
                        _                  => false,
                    }),
            ];

        // ── Restaurant: one role per job on the floor ───────────────────────
        // The order screen sits behind the till's shift gate, so anyone who takes orders also
        // needs to open a shift — hence the pos.sessions keys on Waiter and Restaurant Cashier.
        if (string.Equals(module, "restaurant", StringComparison.OrdinalIgnoreCase))
            return
            [
                // pos.sessions too: a manager opens, closes and approves the shifts the order screen
                // runs on. No restaurant role holds pos.products / pos.customers / pos.reports —
                // those are what surface the retail till.
                new($"{label} Manager", $"Full access to the {label} module.",
                    (m, _) => InModule(m, "restaurant") || m == "pos.sessions"),

                new($"{label} Staff",
                    $"Day-to-day {label} work — can view and record, but not void, discount or refund.",
                    (m, a) => InModule(m, "restaurant") && !PrivilegedActions.Contains(a)),

                // Named apart from the POS "Cashier", which a tenant with retail tills also gets.
                new($"{label} Cashier",
                    "Takes orders and payments at the counter. Opens and closes their own shift; no void, discount or refund.",
                    (m, a) => m switch
                    {
                        "restaurant.orders"       => a is "view" or "create" or "edit",
                        "restaurant.tables"       => a is "view" or "edit",
                        "restaurant.menu"         => a == "view",
                        "restaurant.reservations" => a == "view",
                        "restaurant.delivery"     => a is "view" or "create",
                        "pos.sessions"            => a is "view" or "create",
                        "pos.transactions"        => a is "view" or "create" or "print",
                        _                         => false,
                    }),

                new("Waiter",
                    "Seats guests and takes table orders — tables, orders and reservations. No payments authority beyond the bill.",
                    (m, a) => m switch
                    {
                        "restaurant.orders"       => a is "view" or "create" or "edit",
                        "restaurant.tables"       => a is "view" or "edit",
                        "restaurant.menu"         => a == "view",
                        "restaurant.kitchen"      => a == "view",
                        "restaurant.reservations" => a is "view" or "create" or "edit",
                        "pos.sessions"            => a is "view" or "create",
                        _                         => false,
                    }),

                // menu.edit is what marks a dish sold out — the kitchen is who knows first.
                new("Kitchen Staff",
                    "Works the kitchen display — sees incoming orders, marks them ready, and marks dishes sold out.",
                    (m, a) => m switch
                    {
                        "restaurant.kitchen" => a is "view" or "edit",
                        "restaurant.orders"  => a == "view",
                        "restaurant.menu"    => a is "view" or "edit",
                        _                    => false,
                    }),

                new("Delivery Rider",
                    "Sees delivery orders and updates their status. Nothing else.",
                    (m, a) => m switch
                    {
                        "restaurant.delivery" => a is "view" or "edit",
                        "restaurant.orders"   => a == "view",
                        _                     => false,
                    }),
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
