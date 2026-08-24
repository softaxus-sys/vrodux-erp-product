using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Finance;

/// <summary>Creates a new customer invoice with line items. WRITE action — held for confirmation.</summary>
public sealed class FinanceCreateInvoiceTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "finance_create_invoice";
    public string Description =>
        "Create a new customer invoice with one or more line items. Requires a customer name, invoice date, " +
        "due date, tax rate, and at least one line item (description, quantity, unit price).";
    public string Agent       => "finance";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "finance.invoicing.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "customerName":{"type":"string","description":"Customer name (required)"},
          "customerEmail":{"type":"string","description":"Customer email (optional)"},
          "invoiceDate":{"type":"string","description":"Invoice date, yyyy-MM-dd (required)"},
          "dueDate":{"type":"string","description":"Due date, yyyy-MM-dd (required)"},
          "taxRate":{"type":"number","description":"Tax rate percent, e.g. 5 for 5% (required)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "items":{"type":"array","description":"At least one line item (required)","items":{
            "type":"object","properties":{
              "description":{"type":"string","description":"Line description (required)"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "unitPrice":{"type":"number","description":"Unit price (required)"}
            },"required":["description","quantity","unitPrice"]}}
        },"required":["customerName","invoiceDate","dueDate","taxRate","items"],"additionalProperties":false}
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

        var items = new JsonArray();
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("items", out var itemsEl)
            && itemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in itemsEl.EnumerateArray())
            {
                items.Add(new JsonObject
                {
                    ["description"] = S(item, "description"),
                    ["quantity"]    = N(item, "quantity"),
                    ["unitPrice"]   = N(item, "unitPrice"),
                });
            }
        }

        var body = new JsonObject
        {
            ["customerName"]  = S(args, "customerName"),
            ["customerEmail"] = G(args, "customerEmail"),
            ["invoiceDate"]   = S(args, "invoiceDate"),
            ["dueDate"]       = S(args, "dueDate"),
            ["taxRate"]       = N(args, "taxRate"),
            ["notes"]         = G(args, "notes"),
            ["items"]         = items,
        };

        return gateway.PostAsync("api/finance/invoices", body.ToJsonString(), ct);
    }
}
