using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// Resolves the tools available to the current caller. A tool is offered only if (a) it belongs
/// to the requested agent (or no agent was specified) and (b) the caller holds its required
/// permission (super-admins bypass). This is the first isolation gate — the model is never even
/// told about tools the user isn't allowed to use.
/// </summary>
public sealed class AiToolRegistry(IEnumerable<IAiTool> tools, ICurrentUser currentUser) : IAiToolRegistry
{
    private readonly IReadOnlyList<IAiTool> _tools = tools.ToList();

    public IReadOnlyList<IAiTool> GetTools(string? agent)
    {
        var normalizedAgent = string.IsNullOrWhiteSpace(agent) ? null : agent.Trim().ToLowerInvariant();

        return _tools
            .Where(t => normalizedAgent is null || string.Equals(t.Agent, normalizedAgent, StringComparison.OrdinalIgnoreCase))
            .Where(IsPermitted)
            .ToList();
    }

    public IAiTool? Resolve(string name)
    {
        var tool = _tools.FirstOrDefault(t => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
        return tool is not null && IsPermitted(tool) ? tool : null;
    }

    private bool IsPermitted(IAiTool tool) =>
        tool.RequiredPermission is null
        || currentUser.IsSuperAdmin
        || currentUser.HasPermission(tool.RequiredPermission);
}
