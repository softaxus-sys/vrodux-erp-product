using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Trade;

/// <summary>
/// Books an import or export shipment, with its goods and containers. WRITE action — held for
/// confirmation like every other write tool. Hand-written because the goods and containers are
/// arrays, which a flat field list cannot express.
/// </summary>
public sealed class TradeCreateShipmentTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "trade_create_shipment";
    public string Description =>
        "Book an import or export shipment, optionally with its goods and containers. Link the supplier (import) " +
        "or buyer (export) by partnerId from trade_list_parties; forwarderId and agentId work the same way. " +
        "Costs, payments and documents are added afterwards with trade_add_shipment_cost / _payment / _document. " +
        "Dates are yyyy-MM-dd. exchangeRate is how many units of the company currency one unit of the invoice currency buys (1 when they are the same).";
    public string Agent       => "trade";
    public bool   IsReadOnly  => false;
    public bool   IncludeInAutoMode => false; // write — reached via use_module or by naming the agent
    public string? RequiredPermission => "trade.shipments.create";

    public string ParametersJsonSchema =>
        """
        {"type":"object","properties":{
          "direction":{"type":"string","enum":["import","export"],"description":"import or export (required)"},
          "mode":{"type":"string","enum":["sea","air","road","rail","courier"],"description":"Transport mode (default sea)"},
          "partnerId":{"type":"string","description":"Supplier (import) or buyer (export) party id (GUID) (optional)"},
          "forwarderId":{"type":"string","description":"Freight forwarder / carrier party id (GUID) (optional)"},
          "agentId":{"type":"string","description":"Clearing agent party id (GUID) (optional)"},
          "orderReference":{"type":"string","description":"Purchase or sales order number (optional)"},
          "incoterm":{"type":"string","description":"EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU or DDP (optional)"},
          "blNumber":{"type":"string","description":"Bill of lading / air waybill number (optional)"},
          "carrierName":{"type":"string","description":"Shipping line or airline (optional)"},
          "vesselOrFlight":{"type":"string","description":"Vessel and voyage, or flight (optional)"},
          "originCountry":{"type":"string"},"originPort":{"type":"string"},
          "destinationCountry":{"type":"string"},"destinationPort":{"type":"string"},
          "etd":{"type":"string","description":"Expected departure, yyyy-MM-dd (optional)"},
          "eta":{"type":"string","description":"Expected arrival, yyyy-MM-dd (optional)"},
          "freeDays":{"type":"integer","description":"Free days at the port before demurrage (optional)"},
          "currency":{"type":"string","description":"3-letter invoice currency, e.g. USD (required)"},
          "exchangeRate":{"type":"number","description":"Rate into the company currency (default 1)"},
          "notes":{"type":"string"},
          "items":{"type":"array","description":"Goods on the shipment (optional)","items":{
            "type":"object","properties":{
              "description":{"type":"string","description":"What the goods are (required)"},
              "hsCode":{"type":"string","description":"HS tariff code (optional)"},
              "originCountry":{"type":"string"},
              "quantity":{"type":"number","description":"Quantity (required)"},
              "unit":{"type":"string","description":"Unit, default pcs"},
              "unitPrice":{"type":"number","description":"Price per unit in the invoice currency (required)"},
              "weightKg":{"type":"number","description":"Total weight of this line in kg"},
              "volumeCbm":{"type":"number","description":"Total volume of this line in cubic metres"},
              "packages":{"type":"integer"},
              "productId":{"type":"string","description":"Inventory product id (GUID) (optional)"},
              "sku":{"type":"string"}
            },"required":["description","quantity","unitPrice"]}},
          "containers":{"type":"array","description":"Containers (optional)","items":{
            "type":"object","properties":{
              "number":{"type":"string","description":"Container number (required)"},
              "type":{"type":"string","description":"e.g. 20GP, 40HC"},
              "sealNumber":{"type":"string"},
              "grossWeightKg":{"type":"number"}
            },"required":["number"]}}
        },"required":["direction","currency"],"additionalProperties":false}
        """;

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var items = new JsonArray();
        foreach (var i in ToolJson.Array(args, "items"))
            items.Add(new JsonObject
            {
                ["description"]   = ToolJson.Str(i, "description"),
                ["hsCode"]        = ToolJson.StrOrNull(i, "hsCode"),
                ["originCountry"] = ToolJson.StrOrNull(i, "originCountry"),
                ["quantity"]      = ToolJson.Num(i, "quantity"),
                ["unit"]          = ToolJson.StrOrNull(i, "unit"),
                ["unitPrice"]     = ToolJson.Num(i, "unitPrice"),
                ["weightKg"]      = Opt(i, "weightKg"),
                ["volumeCbm"]     = Opt(i, "volumeCbm"),
                ["packages"]      = Opt(i, "packages"),
                ["productId"]     = ToolJson.StrOrNull(i, "productId"),
                ["sku"]           = ToolJson.StrOrNull(i, "sku"),
            });

        var containers = new JsonArray();
        foreach (var c in ToolJson.Array(args, "containers"))
            containers.Add(new JsonObject
            {
                ["number"]        = ToolJson.Str(c, "number"),
                ["type"]          = ToolJson.StrOrNull(c, "type"),
                ["sealNumber"]    = ToolJson.StrOrNull(c, "sealNumber"),
                ["grossWeightKg"] = Opt(c, "grossWeightKg"),
            });

        var rate = ToolJson.Num(args, "exchangeRate");
        var body = new JsonObject
        {
            ["direction"]          = ToolJson.Str(args, "direction"),
            ["mode"]               = ToolJson.StrOrNull(args, "mode") ?? "sea",
            ["partnerId"]          = ToolJson.StrOrNull(args, "partnerId"),
            ["forwarderId"]        = ToolJson.StrOrNull(args, "forwarderId"),
            ["agentId"]            = ToolJson.StrOrNull(args, "agentId"),
            ["orderReference"]     = ToolJson.StrOrNull(args, "orderReference"),
            ["incoterm"]           = ToolJson.StrOrNull(args, "incoterm"),
            ["blNumber"]           = ToolJson.StrOrNull(args, "blNumber"),
            ["carrierName"]        = ToolJson.StrOrNull(args, "carrierName"),
            ["vesselOrFlight"]     = ToolJson.StrOrNull(args, "vesselOrFlight"),
            ["originCountry"]      = ToolJson.StrOrNull(args, "originCountry"),
            ["originPort"]         = ToolJson.StrOrNull(args, "originPort"),
            ["destinationCountry"] = ToolJson.StrOrNull(args, "destinationCountry"),
            ["destinationPort"]    = ToolJson.StrOrNull(args, "destinationPort"),
            ["etd"]                = ToolJson.StrOrNull(args, "etd"),
            ["eta"]                = ToolJson.StrOrNull(args, "eta"),
            ["freeDays"]           = Opt(args, "freeDays"),
            ["currency"]           = ToolJson.Str(args, "currency").ToUpperInvariant(),
            // A missing rate means "same currency"; sending 0 would be refused as invalid.
            ["exchangeRate"]       = rate > 0 ? rate : 1m,
            ["notes"]              = ToolJson.StrOrNull(args, "notes"),
            ["items"]              = items,
            ["containers"]         = containers,
        };

        return gateway.PostAsync("api/trade/shipments", body.ToJsonString(), ct);
    }

    /// <summary>A number the model left out stays null — an absent weight is not a weight of zero.</summary>
    private static JsonNode? Opt(JsonElement e, string key) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Number
            ? JsonValue.Create(v.GetDecimal()) : null;
}
