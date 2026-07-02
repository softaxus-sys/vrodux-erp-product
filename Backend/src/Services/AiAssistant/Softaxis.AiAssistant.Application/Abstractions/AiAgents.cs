namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// Display metadata for the named agents. The agents are a presentation layer over ONE engine:
/// each agent is just a name + the module's tool subset. Call-by-name ("Vrodux CRM …") maps a
/// spoken/typed name to one of these keys.
/// </summary>
public static class AiAgents
{
    /// <summary>Agent key (matches <see cref="IAiTool.Agent"/>) → human label.</summary>
    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["crm"]                = "CRM",
        ["finance"]            = "Finance",
        ["hr"]                 = "HR",
        ["sales"]              = "Sales",
        ["purchase"]           = "Purchase",
        ["inventory"]          = "Inventory",
        ["pos"]                = "POS",
        ["project-management"] = "Projects",
        ["b2b"]                = "B2B",
        ["education"]          = "Education",
        ["healthcare"]        = "Healthcare",
        ["insurance"]          = "Insurance",
        ["operations"]         = "Operations",
    };

    public static string Label(string agentKey) =>
        Labels.TryGetValue(agentKey, out var label) ? label : agentKey.ToUpperInvariant();
}
