using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Visa;

/// <summary>
/// Opens a new visa case with its applicants. WRITE action — held for confirmation.
/// Hand-written rather than a catalog entry because a case carries a nested applicant array
/// (the primary applicant plus any dependants), which a flat field list cannot express.
/// </summary>
public sealed class VisaCreateCaseTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "visa_create_case";
    public string Description =>
        "Open a new visa case for a client, with one or more applicants. Call visa_list_types first to get " +
        "visaTypeId (its fees and processing time are applied automatically, and its document checklist is " +
        "generated for each applicant). Every applicant needs a first name, last name, nationality and passport " +
        "number — ask the user for anything missing rather than inventing it. The first applicant should have " +
        "relationship \"primary\"; dependants use spouse/child/parent/other.";
    public string Agent       => "visa";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — reached via use_module or by naming the agent
    public string? RequiredPermission => "visa.cases.create";

    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "visaTypeId":{"type":"string","description":"Visa type id (GUID) from visa_list_types (required)"},
          "customerName":{"type":"string","description":"Client / sponsoring company name (required)"},
          "customerId":{"type":"string","description":"CRM account id (GUID) to link the case to (optional)"},
          "emirate":{"type":"string","description":"Emirate the case is filed in, e.g. Dubai (optional)"},
          "priority":{"type":"string","description":"low | medium | high (optional, default medium)"},
          "assignedTo":{"type":"string","description":"PRO / case handler's name (optional)"},
          "serviceFee":{"type":"number","description":"Service fee — omit to use the visa type's default (optional)"},
          "govtFee":{"type":"number","description":"Government fee — omit to use the visa type's default (optional)"},
          "slaDueDate":{"type":"string","description":"SLA due date, yyyy-MM-dd — omit to derive from the visa type's processing days (optional)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "applicants":{"type":"array","description":"At least one applicant (required)","items":{
            "type":"object","properties":{
              "firstName":{"type":"string","description":"First name (required)"},
              "lastName":{"type":"string","description":"Last name (required)"},
              "nationality":{"type":"string","description":"Nationality (required)"},
              "passportNumber":{"type":"string","description":"Passport number (required)"},
              "passportExpiry":{"type":"string","description":"Passport expiry, yyyy-MM-dd (optional)"},
              "dateOfBirth":{"type":"string","description":"Date of birth, yyyy-MM-dd (optional)"},
              "emiratesId":{"type":"string","description":"Emirates ID (optional)"},
              "uidNumber":{"type":"string","description":"UID number (optional)"},
              "relationship":{"type":"string","description":"primary | spouse | child | parent | other (required)"}
            },"required":["firstName","lastName","nationality","passportNumber","relationship"]}}
        },"required":["visaTypeId","customerName","applicants"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var applicants = new JsonArray();
        foreach (var a in ToolJson.Array(args, "applicants"))
        {
            applicants.Add(new JsonObject
            {
                ["firstName"]      = ToolJson.Str(a, "firstName"),
                ["lastName"]       = ToolJson.Str(a, "lastName"),
                ["nationality"]    = ToolJson.Str(a, "nationality"),
                ["passportNumber"] = ToolJson.Str(a, "passportNumber"),
                ["passportExpiry"] = ToolJson.StrOrNull(a, "passportExpiry"),
                ["dateOfBirth"]    = ToolJson.StrOrNull(a, "dateOfBirth"),
                ["emiratesId"]     = ToolJson.StrOrNull(a, "emiratesId"),
                ["uidNumber"]      = ToolJson.StrOrNull(a, "uidNumber"),
                ["relationship"]   = string.IsNullOrWhiteSpace(ToolJson.Str(a, "relationship"))
                                        ? "primary" : ToolJson.Str(a, "relationship"),
            });
        }

        // Fees and the SLA date are left null when unspecified so the backend applies the visa
        // type's own defaults — sending 0 would silently zero out a real fee.
        var body = new JsonObject
        {
            ["visaTypeId"]   = ToolJson.Str(args, "visaTypeId"),
            ["customerName"] = ToolJson.Str(args, "customerName"),
            ["customerId"]   = ToolJson.StrOrNull(args, "customerId"),
            ["emirate"]      = ToolJson.StrOrNull(args, "emirate"),
            ["priority"]     = string.IsNullOrWhiteSpace(ToolJson.Str(args, "priority"))
                                  ? "medium" : ToolJson.Str(args, "priority"),
            ["assignedTo"]   = ToolJson.StrOrNull(args, "assignedTo"),
            ["serviceFee"]   = args.TryGetProperty("serviceFee", out var sf) && sf.ValueKind == JsonValueKind.Number
                                  ? JsonValue.Create(ToolJson.Num(args, "serviceFee")) : null,
            ["govtFee"]      = args.TryGetProperty("govtFee", out var gf) && gf.ValueKind == JsonValueKind.Number
                                  ? JsonValue.Create(ToolJson.Num(args, "govtFee")) : null,
            ["slaDueDate"]   = ToolJson.StrOrNull(args, "slaDueDate"),
            ["notes"]        = ToolJson.StrOrNull(args, "notes"),
            ["applicants"]   = applicants,
        };

        return gateway.PostAsync("api/visa/cases", body.ToJsonString(), ct);
    }
}
