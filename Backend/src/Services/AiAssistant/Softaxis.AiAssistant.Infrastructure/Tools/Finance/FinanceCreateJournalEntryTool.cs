using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Finance;

/// <summary>
/// Creates a new (draft) general-journal entry with its debit/credit lines. WRITE action — held
/// for user confirmation before it runs. Lines must balance (total debits == total credits); the
/// backend rejects an unbalanced entry, so the model should compute this before calling.
/// </summary>
public sealed class FinanceCreateJournalEntryTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "finance_create_journal_entry";
    public string Description =>
        "Create a new draft general-journal entry. Requires a date, description, and at least two balanced " +
        "lines (total debits must equal total credits). Each line needs an accountId (GUID) — look one up " +
        "via finance_list_accounts first if you don't already have it — an accountName, and either a debit " +
        "or a credit amount (never both). The entry is created as a draft; posting it is a separate step.";
    public string Agent       => "finance";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "finance.journals.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "date":{"type":"string","description":"Entry date, yyyy-MM-dd (required)"},
          "description":{"type":"string","description":"Entry description (required)"},
          "reference":{"type":"string","description":"Reference number (optional)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "lines":{"type":"array","description":"At least two lines; total debits must equal total credits (required)","items":{
            "type":"object","properties":{
              "accountId":{"type":"string","description":"Account id (GUID) (required)"},
              "accountName":{"type":"string","description":"Account display name (required)"},
              "debitAmount":{"type":"number","description":"Debit amount, 0 if this line is a credit"},
              "creditAmount":{"type":"number","description":"Credit amount, 0 if this line is a debit"},
              "description":{"type":"string","description":"Line description (optional)"}
            },"required":["accountId","accountName"]}}
        },"required":["date","description","lines"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        string S(JsonElement e, string key) => e.ValueKind == JsonValueKind.Object
                                 && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                                    ? v.GetString() ?? "" : "";
        decimal N(JsonElement e, string key) => e.ValueKind == JsonValueKind.Object
                                  && e.TryGetProperty(key, out var v)
                                  && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)
                                     ? d : 0m;
        JsonNode? G(JsonElement e, string key) => string.IsNullOrWhiteSpace(S(e, key)) ? null : S(e, key);

        var lines = new JsonArray();
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("lines", out var linesEl)
            && linesEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var line in linesEl.EnumerateArray())
            {
                lines.Add(new JsonObject
                {
                    ["accountId"]    = S(line, "accountId"),
                    ["accountName"]  = S(line, "accountName"),
                    ["debitAmount"]  = N(line, "debitAmount"),
                    ["creditAmount"] = N(line, "creditAmount"),
                    ["description"] = G(line, "description"),
                });
            }
        }

        var body = new JsonObject
        {
            ["date"]        = S(args, "date"),
            ["description"] = S(args, "description"),
            ["reference"]   = G(args, "reference"),
            ["notes"]       = G(args, "notes"),
            ["lines"]       = lines,
        };

        return gateway.PostAsync("api/finance/journal-entries", body.ToJsonString(), ct);
    }
}
