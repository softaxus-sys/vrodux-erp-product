using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Purchase;

/// <summary>Creates a new purchase order with line items. WRITE action — held for confirmation.</summary>
public sealed class PurchaseCreateOrderTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "purchase_create_order";
    public string Description =>
        "Create a new purchase order against a vendor, with one or more line items. Look up vendorId via " +
        "purchase_list_vendors first.";
    public string Agent       => "purchase";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — requires an explicit agent
    public string? RequiredPermission => "purchase.orders.create";
    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "vendorId":{"type":"string","description":"Vendor id (GUID) (required)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "expectedDate":{"type":"string","description":"Expected delivery date, yyyy-MM-dd (optional)"},
          "items":{"type":"array","description":"At least one line item (required)","items":{
            "type":"object","properties":{
              "productId":{"type":"string","description":"Product id (GUID) (optional)"},
              "description":{"type":"string","description":"Line description (required)"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "unitCost":{"type":"number","description":"Unit cost (required)"},
              "taxRate":{"type":"number","description":"Tax rate percent (required)"}
            },"required":["description","quantity","unitCost","taxRate"]}}
        },"required":["vendorId","items"],"additionalProperties":false}
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
                    ["productId"]   = G(item, "productId"),
                    ["description"] = S(item, "description"),
                    ["quantity"]    = N(item, "quantity"),
                    ["unitCost"]    = N(item, "unitCost"),
                    ["taxRate"]     = N(item, "taxRate"),
                });
            }
        }

        var body = new JsonObject
        {
            ["vendorId"]     = S(args, "vendorId"),
            ["notes"]        = G(args, "notes"),
            ["expectedDate"] = G(args, "expectedDate"),
            ["items"]        = items,
        };

        return gateway.PostAsync("api/purchase/orders", body.ToJsonString(), ct);
    }
}
