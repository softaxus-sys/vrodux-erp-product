using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>
/// Creates a new CRM lead. This is a WRITE action — the orchestrator returns it as a pending
/// action for the user to confirm before it runs. Mirrors the current CreateLeadCommand shape
/// (assignment, team filing, and lead-gen requirement fields), so an AI-created lead is filed and
/// scored the same way one created from the UI would be — not silently dropped as unassigned.
/// </summary>
public sealed class CrmCreateLeadTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_create_lead";
    public string Description  =>
        "Create a new CRM lead. Requires first name, last name, company, email, and phone (at least one of " +
        "email/phone). If the user hasn't given the required fields, ask for the missing ones before creating; " +
        "do not invent values. Optionally set assignedToUserId + teamId (use crm_list_leads or ask the user for " +
        "the id — this system files a lead's team from the assignee's team, and a lead with no owner is only " +
        "visible to full-access roles) and any lead-gen details the user mentioned (WhatsApp number, budget, " +
        "what they're interested in, a message/note, or when they plan to buy).";
    public string Agent       => "crm";
    public bool   IsReadOnly  => false;
    public string? RequiredPermission => "crm.leads.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "firstName":{"type":"string","description":"Lead's first name (required)"},
          "lastName":{"type":"string","description":"Lead's last name (required)"},
          "company":{"type":"string","description":"Company name (required)"},
          "email":{"type":"string","description":"Email address (required unless phone is given)"},
          "phone":{"type":"string","description":"Phone number (required unless email is given)"},
          "source":{"type":"string","description":"Where the lead came from, e.g. website, referral (optional)"},
          "priority":{"type":"string","description":"low | medium | high (optional, default medium)"},
          "estimatedValue":{"type":"number","description":"Estimated deal value if known (optional)"},
          "assignedToUserId":{"type":"string","description":"User id (GUID) to own this lead (optional)"},
          "teamId":{"type":"string","description":"Team id (GUID) to file this lead under — usually the assignee's team (optional)"},
          "whatsApp":{"type":"string","description":"WhatsApp number if different from phone (optional)"},
          "budget":{"type":"string","description":"Budget the lead mentioned, e.g. \"50k-100k\" (optional)"},
          "interestedIn":{"type":"string","description":"What the lead is interested in, e.g. a product or property type (optional)"},
          "message":{"type":"string","description":"A message or note the lead gave (optional)"},
          "purchaseTimeframe":{"type":"string","description":"When the lead plans to buy, e.g. \"immediate\", \"1-3 months\" (optional)"},
          "notes":{"type":"string","description":"Internal notes about this lead (optional)"}
        },"required":["firstName","lastName","company"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(string key) => args.ValueKind == JsonValueKind.Object
                                 && args.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";
        decimal N(string key) => args.ValueKind == JsonValueKind.Object
                                  && args.TryGetProperty(key, out var v)
                                  && (v.ValueKind == JsonValueKind.Number) && v.TryGetDecimal(out var d)
                                     ? d : 0m;
        JsonNode? G(string key) => string.IsNullOrWhiteSpace(S(key)) ? null : S(key);

        // Fill the full CreateLeadCommand shape; unspecified optional fields get safe defaults.
        var body = new JsonObject
        {
            ["firstName"]          = S("firstName"),
            ["lastName"]           = S("lastName"),
            ["title"]              = "",
            ["company"]            = S("company"),
            ["industry"]           = "",
            ["email"]              = S("email"),
            ["phone"]              = S("phone"),
            ["country"]            = "",
            ["city"]               = "",
            ["source"]             = string.IsNullOrWhiteSpace(S("source")) ? "manual" : S("source"),
            ["priority"]           = string.IsNullOrWhiteSpace(S("priority")) ? "medium" : S("priority"),
            ["estimatedValue"]     = N("estimatedValue"),
            ["assignedTo"]         = "",
            ["notes"]              = G("notes"),
            ["whatsApp"]           = G("whatsApp"),
            ["interestedIn"]       = G("interestedIn"),
            ["budget"]             = G("budget"),
            ["message"]            = G("message"),
            ["assignedToUserId"]   = G("assignedToUserId"),
            ["purchaseTimeframe"]  = G("purchaseTimeframe"),
            ["teamId"]             = G("teamId"),
        };

        return gateway.PostAsync("api/crm/leads", body.ToJsonString(), ct);
    }
}
