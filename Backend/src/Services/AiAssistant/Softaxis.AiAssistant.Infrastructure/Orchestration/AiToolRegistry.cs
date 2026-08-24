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
/// a tenant with every module on sends 65+ tool schemas on every "Auto" turn, which alone can
/// exceed a free-tier model's tokens-per-minute budget before the user's question is even
/// considered. Naming an agent (the picker, or "vrodux finance ...") still unlocks that module's
/// full tool set, writes included.
/// </summary>
public sealed class AiToolRegistry(IEnumerable<IAiTool> tools, ICurrentUser currentUser) : IAiToolRegistry
{
    private readonly IReadOnlyList<IAiTool> _tools = tools.ToList();

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

    /// <summary>
    /// A tool's <see cref="IAiTool.Agent"/> is the module key it operates on ("crm", "finance",
    /// "hr", ...) — this is the one place that enforces "never read/write a module the tenant
    /// hasn't enabled," independent of whether the caller happens to hold the permission.
    /// </summary>
    private bool IsModuleEnabled(IAiTool tool) =>
        currentUser.IsSuperAdmin || currentUser.HasModule(tool.Agent);

    private bool IsPermitted(IAiTool tool) =>
        tool.RequiredPermission is null
        || currentUser.IsSuperAdmin
        || currentUser.HasPermission(tool.RequiredPermission);
}
