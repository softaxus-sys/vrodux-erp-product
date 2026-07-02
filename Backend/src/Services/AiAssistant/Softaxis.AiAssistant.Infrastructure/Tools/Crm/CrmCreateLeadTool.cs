using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>
/// Creates a new CRM lead. This is a WRITE action — the orchestrator returns it as a pending
/// action for the user to confirm before it runs.
/// </summary>
public sealed class CrmCreateLeadTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_create_lead";
    public string Description  => "Create a new CRM lead. Provide at least the lead's first name; company, email, phone and source are optional. Use this when the user asks to add or create a lead.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public string? RequiredPermission => "crm.leads.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "firstName":{"type":"string","description":"Lead's first name (required)"},
          "lastName":{"type":"string"},
          "company":{"type":"string"},
          "email":{"type":"string"},
          "phone":{"type":"string"},
          "source":{"type":"string","description":"Where the lead came from, e.g. website, referral"}
        },"required":["firstName"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(string key) => args.ValueKind == JsonValueKind.Object
                                 && args.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";

        // Fill the full CreateLeadCommand shape; unspecified fields get safe defaults.
        var body = new JsonObject
        {
            ["firstName"]      = S("firstName"),
            ["lastName"]       = S("lastName"),
            ["title"]          = "",
            ["company"]        = S("company"),
            ["industry"]       = "",
            ["email"]          = S("email"),
            ["phone"]          = S("phone"),
            ["country"]        = "",
            ["city"]           = "",
            ["source"]         = string.IsNullOrWhiteSpace(S("source")) ? "manual" : S("source"),
            ["priority"]       = "medium",
            ["estimatedValue"] = 0,
            ["assignedTo"]     = "",
            ["notes"]          = null,
        };

        return gateway.PostAsync("api/crm/leads", body.ToJsonString(), ct);
    }
}
