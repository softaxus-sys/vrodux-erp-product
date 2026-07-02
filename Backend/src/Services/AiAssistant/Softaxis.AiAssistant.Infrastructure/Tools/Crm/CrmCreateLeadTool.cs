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
    public string Description  => "Create a new CRM lead. This system REQUIRES first name, last name, company, email, and phone — all mandatory. If the user hasn't given all of them, ask for the missing ones before creating; do not invent values. Source is optional.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public string? RequiredPermission => "crm.leads.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "firstName":{"type":"string","description":"Lead's first name (required)"},
          "lastName":{"type":"string","description":"Lead's last name (required)"},
          "company":{"type":"string","description":"Company name (required)"},
          "email":{"type":"string","description":"Email address (required)"},
          "phone":{"type":"string","description":"Phone number (required)"},
          "source":{"type":"string","description":"Where the lead came from, e.g. website, referral (optional)"}
        },"required":["firstName","lastName","company","email","phone"],"additionalProperties":false}
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
