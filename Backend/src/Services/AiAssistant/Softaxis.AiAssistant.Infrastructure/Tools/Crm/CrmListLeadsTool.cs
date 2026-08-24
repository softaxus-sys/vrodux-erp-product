using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Tools.Crm;

/// <summary>Lists the tenant's CRM leads (as the current user).</summary>
public sealed class CrmListLeadsTool(GatewayToolClient gateway) : IAiTool
{
    public string Name        => "crm_list_leads";
    public string Description  => "List all CRM leads for the current company, including their name, company, status, source, priority, estimated value, and assigned owner. Use this to answer questions about leads, counts, or who owns what.";
    public string Agent       => "crm";
    public bool   IsReadOnly  => true;
    public bool   IncludeInAutoMode => true; // small, cheap, cross-module-question-worthy
    public string? RequiredPermission => "crm.leads.view";
    public string ParametersJsonSchema =>
        """{"type":"object","properties":{},"additionalProperties":false}""";

    public Task<string> ExecuteAsync(JsonElement arguments, CancellationToken ct) =>
        gateway.GetAsync("api/crm/leads", ct);
}
