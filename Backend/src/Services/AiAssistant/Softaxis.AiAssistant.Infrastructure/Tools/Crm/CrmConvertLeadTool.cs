using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>
/// Converts a qualified CRM lead into an account + contact + opportunity. WRITE action — held
/// for confirmation. This is a bigger step than assigning, so the model should only call it when
/// the user clearly asked to convert/qualify the lead into a deal.
/// </summary>
public sealed class CrmConvertLeadTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_convert_lead";
    public string Description =>
        "Convert a qualified CRM lead into an account, contact, and opportunity. Requires the lead's id " +
        "(from crm_list_leads). The deal title/value/close date are optional — if omitted the system derives " +
        "sensible defaults from the lead.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "crm.leads.edit";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "leadId":{"type":"string","description":"The lead's id (GUID) (required)"},
          "dealTitle":{"type":"string","description":"Title for the new opportunity (optional)"},
          "dealValue":{"type":"number","description":"Value for the new opportunity (optional)"},
          "expectedCloseDate":{"type":"string","description":"yyyy-MM-dd (optional)"}
        },"required":["leadId"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(string key) => args.ValueKind == JsonValueKind.Object
                                 && args.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";
        decimal? Nn(string key)
        {
            if (args.ValueKind == JsonValueKind.Object
                && args.TryGetProperty(key, out var v)
                && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d))
                return d;
            return null;
        }
        JsonNode? G(string key) => string.IsNullOrWhiteSpace(S(key)) ? null : S(key);

        var leadId = S("leadId");
        var body = new JsonObject
        {
            ["dealTitle"]         = G("dealTitle"),
            ["dealValue"]         = Nn("dealValue"),
            ["expectedCloseDate"] = G("expectedCloseDate"),
        };

        return gateway.PostAsync($"api/crm/leads/{leadId}/convert", body.ToJsonString(), ct);
    }
}
