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
        ["crm.pipeline"]         = ["view","create","edit","export"],
        ["crm.customers"]        = ["view","create","edit","delete","export"],

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
