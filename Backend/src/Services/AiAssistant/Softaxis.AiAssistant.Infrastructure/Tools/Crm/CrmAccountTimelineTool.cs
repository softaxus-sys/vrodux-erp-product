using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>Fetches the unified activity timeline for one CRM account (its own activity plus its deals'/originating lead's).</summary>
public sealed class CrmAccountTimelineTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_account_timeline";
    public string Description =>
        "Get the activity timeline for one CRM account/customer — a merged, chronological feed of calls, " +
        "emails, notes and tasks logged against that account, its opportunities, and the lead it was " +
        "converted from. Use to answer 'what's the recent activity on this account'.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => true;
    public string? RequiredPermission => "crm.customers.view";
    public string ParametersJsonSchema =>
        """{"type":"object","properties":{"customerId":{"type":"string","description":"The account/customer's id (GUID) (required)"}},"required":["customerId"],"additionalProperties":false}""";

    public Task<string> ExecuteAsync(JsonElement args, CancellationToken ct)
    {
        var customerId = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("customerId", out var v)
                          && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        return gateway.GetAsync($"api/crm/customers/{customerId}/timeline", ct);
    }
}
