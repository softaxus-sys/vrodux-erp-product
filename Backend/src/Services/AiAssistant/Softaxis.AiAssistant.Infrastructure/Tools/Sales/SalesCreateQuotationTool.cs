using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Sales;

/// <summary>Creates a sales quotation with line items. WRITE action — held for confirmation.</summary>
public sealed class SalesCreateQuotationTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "sales_create_quotation";
    public string Description =>
        "Create a sales quotation with one or more line items. Link the customer by customerId (GUID, from " +
        "sales_list_customers) and/or a free-text customerName. Each line can reference a productId or be " +
        "free-text via description. Use sales_convert_quotation later to turn an accepted quote into an order.";
    public string Agent       => "sales";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — reached via use_module or by naming the agent
    public string? RequiredPermission => "sales.quotations.create";

    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "customerId":{"type":"string","description":"Customer id (GUID) (optional)"},
          "customerName":{"type":"string","description":"Customer name (optional, but give at least one of customerId/customerName)"},
          "notes":{"type":"string","description":"Notes (optional)"},
          "validUntil":{"type":"string","description":"Valid until, yyyy-MM-dd (optional)"},
          "discountPercent":{"type":"number","description":"Whole-quotation discount percent (optional)"},
          "items":{"type":"array","description":"At least one line item (required)","items":{
            "type":"object","properties":{
              "productId":{"type":"string","description":"Product id (GUID) (optional)"},
              "description":{"type":"string","description":"Line description (required)"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "unitPrice":{"type":"number","description":"Unit price (required)"},
              "discountPercent":{"type":"number","description":"Line discount percent (optional)"},
              "taxRate":{"type":"number","description":"Tax rate percent (optional)"}
            },"required":["description","quantity","unitPrice"]}}
        },"required":["items"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var items = new JsonArray();
        foreach (var i in ToolJson.Array(args, "items"))
        {
            items.Add(new JsonObject
            {
                ["productId"]       = ToolJson.StrOrNull(i, "productId"),
                ["description"]     = ToolJson.Str(i, "description"),
                ["quantity"]        = ToolJson.Num(i, "quantity"),
                ["unitPrice"]       = ToolJson.Num(i, "unitPrice"),
                ["discountPercent"] = ToolJson.Num(i, "discountPercent"),
                ["taxRate"]         = ToolJson.Num(i, "taxRate"),
            });
        }

        var body = new JsonObject
        {
            ["customerId"]      = ToolJson.StrOrNull(args, "customerId"),
            ["customerName"]    = ToolJson.StrOrNull(args, "customerName"),
            ["notes"]           = ToolJson.StrOrNull(args, "notes"),
            ["validUntil"]      = ToolJson.StrOrNull(args, "validUntil"),
            ["discountPercent"] = ToolJson.Num(args, "discountPercent"),
            ["items"]           = items,
        };

        return gateway.PostAsync("api/sales/quotations", body.ToJsonString(), ct);
    }
}
