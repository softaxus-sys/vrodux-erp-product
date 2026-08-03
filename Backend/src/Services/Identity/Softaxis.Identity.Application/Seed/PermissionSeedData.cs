using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Seed;

/// <summary>
/// Canonical list of all ERP permissions — mirrors the frontend roles-permissions.mock.ts.
/// These are seeded once at startup and never changed via the API.
/// </summary>
public static class PermissionSeedData
{
    private static readonly string[] AllActions =
        ["view", "create", "edit", "delete", "approve", "export", "print", "void", "refund", "discount", "adjust"];

    private static readonly Dictionary<string, string[]> ModuleActions = new()
    {
        // Inventory
        ["inventory.stock"]      = ["view","create","edit","delete","export","adjust"],
        ["inventory.warehouses"] = ["view","create","edit","delete"],
        ["inventory.movements"]  = ["view","create","export","adjust"],
        ["inventory.transfers"]  = ["view","create","approve","export"],

        // POS
        ["pos.sessions"]         = ["view","create","approve"],
        ["pos.transactions"]     = ["view","create","print","void","refund","discount"],
        ["pos.products"]         = ["view","create","edit","delete"],
        ["pos.reports"]          = ["view","export","print"],
        // Wallet/house-account actions on customers — CustomersController itself has no permission
        // gating today (pre-existing, not retrofitted here); these new endpoints only are gated.
        ["pos.customers"]        = ["view","edit"],
        ["pos.payment-gateway"]  = ["view","edit"],

        // Finance
        ["finance.accounting"]   = ["view","create","edit","delete","approve","export"],
        ["finance.gl"]           = ["view","create","edit","approve","export"],
        ["finance.journals"]     = ["view","create","edit","approve","export","print"],
        ["finance.invoicing"]    = ["view","create","edit","delete","approve","export","print"],
        ["finance.expenses"]     = ["view","create","edit","delete","approve","export"],
        ["finance.budgeting"]    = ["view","create","edit","approve","export"],
        ["finance.tax"]          = ["view","create","edit","approve","export"],
        ["finance.banking"]      = ["view","create","edit","approve","export"],

        // HR
        ["hr.employees"]         = ["view","create","edit","delete","export"],
        ["hr.attendance"]        = ["view","create","edit","export","adjust"],
        ["hr.payroll"]           = ["view","create","approve","export","print"],
        ["hr.leaves"]            = ["view","create","edit","approve"],
        ["hr.recruitment"]       = ["view","create","edit","delete"],
        ["hr.performance"]       = ["view","create","edit","export"],

        // CRM
        ["crm.leads"]            = ["view","create","edit","delete","export"],
        // Assigned-only lead scope: a role granted these (but NOT crm.leads.view/edit) sees & works
        // ONLY the leads assigned to that user. "edit" here also covers reassigning the user's own lead.
        ["crm.leads-assigned"]   = ["view","edit"],
        ["crm.pipeline"]         = ["view","create","edit","export"],
        ["crm.customers"]        = ["view","create","edit","delete","export"],

        // CRM industry packs — B2B (Proposals → Contracts → Support Tickets)
        ["b2b.proposals"]        = ["view","create","edit","delete"],
        ["b2b.contracts"]        = ["view","create","edit","delete"],
        ["b2b.tickets"]          = ["view","create","edit","delete"],

        // CRM industry packs — Education (Admissions → Students → Enrollments)
        ["education.admissions"] = ["view","create","edit","delete"],
        ["education.students"]   = ["view","create","edit","delete"],
        ["education.enrollments"]= ["view","create","edit","delete"],

        // CRM industry packs — Healthcare (Patients → Appointments → Treatment Plans)
        ["healthcare.patients"]         = ["view","create","edit","delete"],
        ["healthcare.appointments"]     = ["view","create","edit","delete"],
        ["healthcare.treatment-plans"]  = ["view","create","edit","delete"],

        // CRM industry packs — Insurance (Policies → Renewals → Claims)
        ["insurance.policies"]   = ["view","create","edit","delete"],
        ["insurance.renewals"]   = ["view","create","edit","delete"],
        ["insurance.claims"]     = ["view","create","edit","delete","approve"],

        // Sales
        ["sales.quotations"]     = ["view","create","edit","delete","approve","export","print"],
        ["sales.orders"]         = ["view","create","edit","approve","export","print"],
        ["sales.returns"]        = ["view","create","approve","export","print"],

        // Purchase
        ["purchase.vendors"]     = ["view","create","edit","delete","export"],
        ["purchase.orders"]      = ["view","create","edit","approve","export","print"],
        ["purchase.approvals"]   = ["view","approve"],

        // Settings
        ["settings.general"]     = ["view","edit"],
        ["settings.users"]       = ["view","create","edit","delete"],
        ["settings.roles"]       = ["view","create","edit","delete"],
        ["settings.branches"]    = ["view","create","edit","delete"],
        ["settings.integrations"]= ["view","edit"],
        ["settings.audit"]       = ["view","export"],
        ["settings.ai"]          = ["view","edit"],

        // Project Management
        ["project-management.projects"] = ["view","create","edit","delete"],
        ["project-management.boards"]   = ["view","create","edit","delete"],
        ["project-management.labels"]   = ["view","create","edit","delete"],
        ["project-management.sprints"]  = ["view","create","edit","delete"],
        ["project-management.issues"]   = ["view","create","edit","delete"],

        // Visa Services (UAE visa consultancy — cases, applicants, documents)
        ["visa.cases"] = ["view","create","edit","delete"],

        // Restaurant POS (tables, menu, orders incl. void/discount/refund, kitchen, reservations)
        ["restaurant.tables"]       = ["view","create","edit"],
        ["restaurant.menu"]         = ["view","create","edit"],
        ["restaurant.orders"]       = ["view","create","edit","void","discount","refund"],
        ["restaurant.kitchen"]      = ["view","edit"],
        ["restaurant.reservations"] = ["view","create","edit"],
        // Delivery zones/drivers/delivery-order lifecycle (Epic 6)
        ["restaurant.delivery"]     = ["view","create","edit"],
        // Reports & role-scoped dashboards (Epic 8) — read-only, no create/edit/delete
        ["restaurant.reports"]      = ["view"],
        // Assigning users to branches for scoped table/order/reservation/waitlist visibility (Epic 9)
        ["restaurant.branches"]     = ["view","edit"],
        // SMS/WhatsApp provider credentials for digital receipts (Epic 9)
        ["restaurant.notifications"] = ["view","edit"],
        // Registered POS terminals/tablets — inventory/observability, not access control (Epic 9)
        ["restaurant.devices"]      = ["view","edit"],
    };

    public static IReadOnlyList<Permission> GetPermissions()
    {
        var list = new List<Permission>();

        // Deterministic GUIDs so re-seeding is idempotent
        foreach (var (moduleId, actions) in ModuleActions)
        {
            foreach (var action in actions)
            {
                var key = $"{moduleId}.{action}";
                var id  = GuidFromString(key);
                list.Add(new Permission(id, moduleId, action, $"{Capitalise(action)} {moduleId.Replace('.', ' ')}"));
            }
        }

        return list;
    }

    private static Guid GuidFromString(string input)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(input));
        return new Guid(bytes);
    }

    private static string Capitalise(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];
}
