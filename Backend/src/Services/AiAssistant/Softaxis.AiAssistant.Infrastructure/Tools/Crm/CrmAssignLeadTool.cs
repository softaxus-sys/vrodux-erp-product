using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>
/// Reassigns (or files) an existing CRM lead to a user/team. WRITE action — held for confirmation.
/// </summary>
public sealed class CrmAssignLeadTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_assign_lead";
    public string Description =>
        "Assign or reassign an existing CRM lead to a user, optionally filing it under one of that user's " +
        "teams. Requires the lead's id (from crm_list_leads) and the target user's id and display name. " +
        "Filing a lead's team matters: an unfiled lead is only visible to full-access roles, not team leads.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "crm.leads.edit";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "leadId":{"type":"string","description":"The lead's id (GUID) (required)"},
          "toUserId":{"type":"string","description":"The user id (GUID) to assign the lead to (required)"},
          "toUserName":{"type":"string","description":"That user's display name (required)"},
          "teamId":{"type":"string","description":"Team id (GUID) to file the lead under — usually the assignee's team (optional)"},
          "note":{"type":"string","description":"A short note about why it's being reassigned (optional)"}
        },"required":["leadId","toUserId","toUserName"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(string key) => args.ValueKind == JsonValueKind.Object
                                 && args.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";
        JsonNode? G(string key) => string.IsNullOrWhiteSpace(S(key)) ? null : S(key);

        var leadId = S("leadId");
        var body = new JsonObject
        {
            ["toUserId"]   = G("toUserId"),
            ["toUserName"] = S("toUserName"),
            ["teamId"]     = G("teamId"),
            ["note"]       = G("note"),
        };

        return gateway.PostAsync($"api/crm/leads/{leadId}/assign", body.ToJsonString(), ct);
    }
}
