using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>
/// Creates a new CRM opportunity/deal. WRITE action — held for user confirmation before it runs.
/// </summary>
public sealed class CrmCreateDealTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_create_deal";
    public string Description =>
        "Create a new CRM opportunity (deal) in the sales pipeline. Requires a title, company, value, and " +
        "stage. Stage must be one of: new, qualified, proposal, negotiation, won, lost. Optionally link it to " +
        "an existing account via customerId (from crm_customers_summary or by asking the user) and/or assign " +
        "an owner via assignedToUserId + teamId.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public string? RequiredPermission => "crm.pipeline.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "title":{"type":"string","description":"Deal/opportunity name (required)"},
          "company":{"type":"string","description":"Company name (required)"},
          "value":{"type":"number","description":"Deal value (required)"},
          "stage":{"type":"string","description":"new | qualified | proposal | negotiation | won | lost (required)"},
          "priority":{"type":"string","description":"low | medium | high (optional, default medium)"},
          "probability":{"type":"integer","description":"Win probability 0-100 (optional)"},
          "expectedCloseDate":{"type":"string","description":"yyyy-MM-dd (optional)"},
          "source":{"type":"string","description":"Where this opportunity came from (optional)"},
          "industry":{"type":"string","description":"Industry (optional)"},
          "description":{"type":"string","description":"Free-text description (optional)"},
          "customerId":{"type":"string","description":"Account/customer id (GUID) to link this deal to (optional)"},
          "assignedToUserId":{"type":"string","description":"User id (GUID) to own this deal (optional)"},
          "teamId":{"type":"string","description":"Team id (GUID) to file this deal under (optional)"}
        },"required":["title","company","value","stage"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(string key) => args.ValueKind == JsonValueKind.Object
                                 && args.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";
        decimal N(string key) => args.ValueKind == JsonValueKind.Object
                                  && args.TryGetProperty(key, out var v)
                                  && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)
                                     ? d : 0m;
        int I(string key, int fallback) => args.ValueKind == JsonValueKind.Object
                                  && args.TryGetProperty(key, out var v)
                                  && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)
                                     ? n : fallback;
        JsonNode? G(string key) => string.IsNullOrWhiteSpace(S(key)) ? null : S(key);

        var body = new JsonObject
        {
            ["title"]             = S("title"),
            ["company"]           = S("company"),
            ["value"]             = N("value"),
            ["stage"]             = S("stage"),
            ["priority"]          = string.IsNullOrWhiteSpace(S("priority")) ? "medium" : S("priority"),
            ["probability"]       = I("probability", 50),
            ["expectedCloseDate"] = string.IsNullOrWhiteSpace(S("expectedCloseDate"))
                                        ? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd")
                                        : S("expectedCloseDate"),
            ["assignedTo"]        = "",
            ["source"]            = string.IsNullOrWhiteSpace(S("source")) ? "manual" : S("source"),
            ["industry"]          = S("industry"),
            ["description"]       = S("description"),
            ["customerId"]        = G("customerId"),
            ["assignedToUserId"]  = G("assignedToUserId"),
            ["teamId"]            = G("teamId"),
        };

        return gateway.PostAsync("api/crm/deals", body.ToJsonString(), ct);
    }
}
