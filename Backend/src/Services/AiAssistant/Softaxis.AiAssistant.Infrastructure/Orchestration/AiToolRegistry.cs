using Softaxis.AiAssistant.Application.Abstractions;

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

    public AiToolRegistry(IEnumerable<IAiTool> tools, ICurrentUser currentUser)
    {
        _currentUser = currentUser;
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
        || _currentUser.IsSuperAdmin
        || _currentUser.HasModule(tool.Agent);

    /// <summary>
    /// A comma-separated <see cref="IAiTool.RequiredPermission"/> means "any of these" — see the
    /// remarks there for why the tiered CRM scopes need it.
    /// </summary>
    private bool IsPermitted(IAiTool tool)
    {
        if (tool.RequiredPermission is null || _currentUser.IsSuperAdmin) return true;

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
}
