using Microsoft.Extensions.Configuration;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// Resolves the tools available to the current caller. A tool is offered only if (a) it belongs
/// to the requested agent — or, when no agent was specified ("Auto" mode), it opts into
/// <see cref="IAiTool.IncludeInAutoMode"/> — (b) the caller's tenant has that tool's module
/// enabled/subscribed (super-admins bypass), and (c) the caller holds its required permission
/// (super-admins bypass). This is the first isolation gate — the model is never even told about
/// tools for a disabled module or that the user isn't allowed to use, and a disabled module's
/// tools are excluded up front rather than failing at execution time.
///
/// The Auto-mode restriction exists so the total tool-schema payload sent to the model stays
/// small and roughly constant regardless of how many modules a tenant has enabled — without it,
/// a tenant with every module on sends 150+ tool schemas on every "Auto" turn, which alone can
/// exceed a free-tier model's tokens-per-minute budget before the user's question is even
/// considered. Auto mode therefore starts with the cheap cross-module read set plus the
/// <c>use_module</c> tool, which loads one module's full tool set — writes included — on demand
/// (see <see cref="UseModuleTool"/> and AiOrchestrator). Naming an agent (the picker, or
/// "vrodux finance ...") still unlocks that module's full tool set up front.
/// </summary>
public sealed class AiToolRegistry : IAiToolRegistry
{
    private readonly IReadOnlyList<IAiTool> _tools;
    private readonly ICurrentUser _currentUser;
    private readonly IConfiguration _configuration;

    public AiToolRegistry(IEnumerable<IAiTool> tools, ICurrentUser currentUser, IConfiguration configuration)
    {
        _currentUser = currentUser;
        _configuration = configuration;
        // UseModuleTool is built here rather than injected: it needs the registry to describe what
        // is loadable, and the registry needs every IAiTool — as a DI registration that is a cycle.
        _tools = [.. tools, new UseModuleTool(this)];
    }

    public IReadOnlyList<IAiTool> GetTools(string? agent)
    {
        var normalizedAgent = string.IsNullOrWhiteSpace(agent) ? null : agent.Trim().ToLowerInvariant();

        return _tools
            .Where(t => normalizedAgent is null
                ? t.IncludeInAutoMode
                : string.Equals(t.Agent, normalizedAgent, StringComparison.OrdinalIgnoreCase))
            .Where(IsModuleEnabled)
            .Where(IsPermitted)
            .ToList();
    }

    public IAiTool? Resolve(string name)
    {
        var tool = _tools.FirstOrDefault(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
        return tool is not null && IsModuleEnabled(tool) && IsPermitted(tool) ? tool : null;
    }

    public IReadOnlyList<string> GetAvailableModules() =>
        _tools
            .Where(t => !string.Equals(t.Agent, AiToolAgents.Core, StringComparison.OrdinalIgnoreCase))
            .Where(IsModuleEnabled)
            .Where(IsPermitted)
            .Select(t => t.Agent.ToLowerInvariant())
            .Distinct()
            .Order(StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// A tool's <see cref="IAiTool.Agent"/> is the module key it operates on ("crm", "finance",
    /// "hr", ...) — this is the one place that enforces "never read/write a module the tenant
    /// hasn't enabled," independent of whether the caller happens to hold the permission.
    /// <see cref="AiToolAgents.Core"/> is the exception: it marks assistant plumbing that belongs
    /// to no module (tool discovery), so gating it on a licence would make the assistant unable to
    /// find its own capabilities.
    /// </summary>
    private bool IsModuleEnabled(IAiTool tool) =>
        string.Equals(tool.Agent, AiToolAgents.Core, StringComparison.OrdinalIgnoreCase)
        || string.Equals(tool.Agent, AiToolAgents.Support, StringComparison.OrdinalIgnoreCase)
        || _currentUser.IsSuperAdmin
        || _currentUser.HasModule(tool.Agent);

    /// <summary>
    /// A comma-separated <see cref="IAiTool.RequiredPermission"/> means "any of these" — see the
    /// remarks there for why the tiered CRM scopes need it. An empty string means the same as
    /// null ("no permission required") — several Support tools use it because raising or reading
    /// your own workspace's tickets needs no grant, same as the HTTP endpoints themselves; the
    /// record types those tools are built from (AiCreateSpec/AiGetByIdSpec/AiActionSpec) declare
    /// Permission as non-nullable, so "" is how they express "none" where AiListSpec can use null
    /// directly.
    /// </summary>
    private bool IsPermitted(IAiTool tool)
    {
        if (_currentUser.IsSuperAdmin) return true;

        // Support's AGENT-side tools (queue, assign, status, priority) use a non-empty
        // RequiredPermission — unlike the always-open customer tools (support_create_ticket etc.,
        // which use ""). Those additionally require the caller's own tenant to be the configured
        // Support operator tenant, mirroring the backend's ISupportAccessGuard and the frontend's
        // SupportQueueGuard: `support.tickets.*` is auto-granted to every tenant's Administrator
        // role (harmless there, since the HTTP endpoint enforces the same check regardless), but
        // the model should never even be shown a queue tool it cannot actually use — offering a
        // tool that always 403s reads as the assistant being broken, not as access being denied.
        if (string.Equals(tool.Agent, AiToolAgents.Support, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(tool.RequiredPermission))
        {
            var operatorTenantId = _configuration["Support:OperatorTenantId"];
            if (string.IsNullOrWhiteSpace(operatorTenantId)
                || !Guid.TryParse(operatorTenantId, out var opId)
                || TenantAmbient.TenantId != opId)
                return false;
        }

        if (string.IsNullOrEmpty(tool.RequiredPermission)) return true;

        return tool.RequiredPermission
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(_currentUser.HasPermission);
    }
}

/// <summary>Agent keys that are not module keys.</summary>
public static class AiToolAgents
{
    /// <summary>Assistant plumbing available in every tenant regardless of the modules licensed.</summary>
    public const string Core = "core";

    /// <summary>
    /// Support ticket tools — available in every tenant regardless of which modules are licensed,
    /// same reasoning as Core: raising a ticket with the vendor is not a purchasable feature, and
    /// gating it on "support" being in Tenant.ResolvedModules would hide it from every real
    /// customer, since "support" is deliberately not a subscribable module (see the frontend's
    /// hasModuleAccess — it's always-on there for the same reason). Unlike Core, this DOES appear
    /// as a selectable agent in the picker, since a user reasonably wants to address it directly
    /// ("ask Support…") rather than treating it as invisible plumbing.
    /// </summary>
    public const string Support = "support";
}
