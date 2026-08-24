using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Sales;

/// <summary>Creates a new sales order with line items. WRITE action — held for confirmation.</summary>
public sealed class SalesCreateOrderTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "sales_create_order";
    public string Description =>
        "Create a new sales order with one or more line items. Customer can be linked by customerId (GUID) " +
        "and/or a free-text customerName. Each line can reference a productId (GUID, optional) or be free-text " +
        "via description.";
    public string Agent       => "sales";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "sales.orders.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "customerId":{"type":"string","description":"Customer id (GUID) (optional)"},
          "customerName":{"type":"string","description":"Customer name (optional, but give at least one of customerId/customerName)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "expectedDate":{"type":"string","description":"Expected delivery date, yyyy-MM-dd (optional)"},
          "items":{"type":"array","description":"At least one line item (required)","items":{
            "type":"object","properties":{
              "productId":{"type":"string","description":"Product id (GUID) (optional)"},
              "description":{"type":"string","description":"Line description (required)"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "unitPrice":{"type":"number","description":"Unit price (required)"},
              "discountPercent":{"type":"number","description":"Discount percent (optional)"},
              "taxRate":{"type":"number","description":"Tax rate percent (optional)"}
            },"required":["description","quantity","unitPrice"]}}
        },"required":["items"],"additionalProperties":false}
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
                    ["productId"]        = G(item, "productId"),
                    ["description"]      = S(item, "description"),
                    ["quantity"]         = N(item, "quantity"),
                    ["unitPrice"]        = N(item, "unitPrice"),
                    ["discountPercent"]  = N(item, "discountPercent"),
                    ["taxRate"]          = N(item, "taxRate"),
                });
            }
        }

        var body = new JsonObject
        {
            ["customerId"]   = G(args, "customerId"),
            ["customerName"] = G(args, "customerName"),
            ["notes"]        = G(args, "notes"),
            ["expectedDate"] = G(args, "expectedDate"),
            ["items"]        = items,
        };

        return gateway.PostAsync("api/sales/orders", body.ToJsonString(), ct);
    }
}
