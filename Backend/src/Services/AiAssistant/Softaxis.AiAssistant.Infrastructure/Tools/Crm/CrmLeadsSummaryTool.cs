using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>Returns aggregate CRM lead metrics (totals, by-status counts, values) for the tenant.</summary>
public sealed class CrmLeadsSummaryTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_leads_summary";
    public string Description  => "Get summary statistics for CRM leads for the current company — total count, counts by status, total and average estimated value. Use this for high-level questions like 'how many leads do we have' or 'what's our pipeline value'.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => true;
    public string? RequiredPermission => "crm.leads.view";
    public string ParametersJsonSchema =>
        """{"type":"object","properties":{},"additionalProperties":false}""";

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct) =>
        gateway.GetAsync("api/crm/leads/summary", ct);
}
