using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Restaurant;

/// <summary>
/// Opens a restaurant order with its line items. WRITE action — held for confirmation.
/// </summary>
public sealed class RestaurantCreateOrderTool(GatewayToolClient gateway, ICurrentUser currentUser) : IAiTool
{
    public string Name        => "restaurant_create_order";
    public string Description =>
        "Open a new restaurant order (dine-in, takeaway, or delivery) with one or more menu items. Call " +
        "restaurant_list_menu for menuItemId and restaurant_list_tables for tableId. Use " +
        "restaurant_send_order_to_kitchen afterwards to fire it.";
    public string Agent       => "restaurant";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — reached via use_module or by naming the agent
    public string? RequiredPermission => "restaurant.orders.create";

    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "orderType":{"type":"string","description":"dine_in | takeaway | delivery (required)"},
          "tableId":{"type":"string","description":"Table id (GUID) — required for dine-in (optional otherwise)"},
          "covers":{"type":"integer","description":"Number of guests (optional, default 1)"},
          "waiter":{"type":"string","description":"Waiter / server name (optional — defaults to you)"},
          "notes":{"type":"string","description":"Kitchen notes for the whole order (optional)"},
          "items":{"type":"array","description":"At least one item (required)","items":{
            "type":"object","properties":{
              "menuItemId":{"type":"string","description":"Menu item id (GUID) (required)"},
              "quantity":{"type":"integer","description":"Quantity (required)"},
              "modifiers":{"type":"string","description":"Free-text special instructions for this line, e.g. \"no onions\" (optional)"}
            },"required":["menuItemId","quantity"]}}
        },"required":["orderType","items"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var items = new JsonArray();
        foreach (var i in ToolJson.Array(args, "items"))
        {
            var qty = ToolJson.Int(i, "quantity");
            items.Add(new JsonObject
            {
                ["menuItemId"] = ToolJson.Str(i, "menuItemId"),
                ["quantity"]   = qty <= 0 ? 1 : qty,
                ["modifiers"]  = ToolJson.StrOrNull(i, "modifiers"),
            });
        }

        var covers = ToolJson.Int(args, "covers");
        var waiter = ToolJson.Str(args, "waiter");

        var body = new JsonObject
        {
            ["tableId"]   = ToolJson.StrOrNull(args, "tableId"),
            ["waiter"]    = string.IsNullOrWhiteSpace(waiter)
                                ? currentUser.Username ?? currentUser.Email ?? "" : waiter,
            ["covers"]    = covers <= 0 ? 1 : covers,
            ["orderType"] = ToolJson.Str(args, "orderType"),
            ["notes"]     = ToolJson.StrOrNull(args, "notes"),
            ["items"]     = items,
        };

        return gateway.PostAsync("api/restaurant/orders", body.ToJsonString(), ct);
    }
}
