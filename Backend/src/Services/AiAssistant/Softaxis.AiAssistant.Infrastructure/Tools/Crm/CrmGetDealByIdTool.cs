using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>Fetches one CRM opportunity's full detail, including contacts and forecast fields.</summary>
public sealed class CrmGetDealByIdTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_get_deal_by_id";
    public string Description =>
        "Get full detail for one CRM opportunity/deal by id — stage, value, probability, forecast category, " +
        "linked account, and contacts. Use after crm_pipeline_summary or crm_list_leads (via its converted " +
        "deal) to look up one specific deal's detail.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => true;
    public string? RequiredPermission => "crm.pipeline.view";
    public string ParametersJsonSchema =>
        """{"type":"object","properties":{"dealId":{"type":"string","description":"The deal's id (GUID) (required)"}},"required":["dealId"],"additionalProperties":false}""";

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var dealId = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("dealId", out var v)
                     && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        return gateway.GetAsync($"api/crm/deals/{dealId}", ct);
    }
}
