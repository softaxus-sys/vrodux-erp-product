using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Purchase;

/// <summary>
/// Raises a purchase requisition (approval request) with its requested items. WRITE action — held
/// for confirmation. The web UI never got a create form for this (its "New Request" button is
/// still unwired), so the assistant is currently the only way to raise one — the endpoint itself
/// has existed all along.
/// </summary>
public sealed class PurchaseCreateRequisitionTool(GatewayToolClient gateway, ICurrentUser currentUser) : IAiTool
{
    public string Name        => "purchase_create_requisition";
    public string Description =>
        "Raise a purchase requisition (an approval request to buy something) with one or more requested items. " +
        "Use purchase_approve_request / purchase_reject_request to action it afterwards.";
    public string Agent       => "purchase";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — reached via use_module or by naming the agent
    // There is no purchase.approvals.create key seeded — raising a requisition is a buying action,
    // so it gates on the nearest one, matching the controller's own attribute.
    public string? RequiredPermission => "purchase.orders.create";

    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "title":{"type":"string","description":"What is being requested (required)"},
          "department":{"type":"string","description":"Requesting department (required)"},
          "requiredBy":{"type":"string","description":"Date it is needed by, yyyy-MM-dd (required)"},
          "justification":{"type":"string","description":"Why it is needed (required)"},
          "priority":{"type":"string","description":"low | medium | high | urgent (optional, default medium)"},
          "category":{"type":"string","description":"Spend category (optional)"},
          "vendorSuggestion":{"type":"string","description":"Suggested vendor (optional)"},
          "currency":{"type":"string","description":"Currency code (optional)"},
          "items":{"type":"array","description":"At least one requested item (required)","items":{
            "type":"object","properties":{
              "description":{"type":"string","description":"Item description (required)"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "estimatedUnitPrice":{"type":"number","description":"Estimated unit price (required)"}
            },"required":["description","quantity","estimatedUnitPrice"]}}
        },"required":["title","department","requiredBy","justification","items"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var items = new JsonArray();
        foreach (var i in ToolJson.Array(args, "items"))
        {
            items.Add(new JsonObject
            {
                ["description"]        = ToolJson.Str(i, "description"),
                ["quantity"]           = ToolJson.Num(i, "quantity"),
                ["estimatedUnitPrice"] = ToolJson.Num(i, "estimatedUnitPrice"),
            });
        }

        var body = new JsonObject
        {
            ["title"]            = ToolJson.Str(args, "title"),
            // The requester is whoever is talking to the assistant — never something to ask the model for.
            ["requestedBy"]      = currentUser.Username ?? currentUser.Email ?? "",
            ["department"]       = ToolJson.Str(args, "department"),
            ["requiredBy"]       = ToolJson.Str(args, "requiredBy"),
            ["priority"]         = string.IsNullOrWhiteSpace(ToolJson.Str(args, "priority"))
                                      ? "medium" : ToolJson.Str(args, "priority"),
            ["category"]         = ToolJson.Str(args, "category"),
            ["vendorSuggestion"] = ToolJson.StrOrNull(args, "vendorSuggestion"),
            ["justification"]    = ToolJson.Str(args, "justification"),
            ["currency"]         = ToolJson.Str(args, "currency"),
            ["items"]            = items,
        };

        return gateway.PostAsync("api/purchase/approvals", body.ToJsonString(), ct);
    }
}
