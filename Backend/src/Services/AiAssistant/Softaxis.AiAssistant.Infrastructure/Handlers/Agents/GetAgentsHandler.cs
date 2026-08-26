using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Agents.Dtos;
using Softaxis.AiAssistant.Application.Agents.Queries;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Agents;

internal sealed class GetAgentsHandler(IAiToolRegistry toolRegistry)
    : IQueryHandler<GetAgentsQuery, IReadOnlyList<AiAgentDto>>
{
    public Task<Result<IReadOnlyList<AiAgentDto>>> Handle(GetAgentsQuery request, CancellationToken ct)
    {
        // Built from every module the caller can act in, NOT from the Auto-mode tool set. Grouping
        // the Auto-mode tools (as this did before) silently dropped every module without a cheap
        // cross-module read tool — Restaurant, Visa, POS and the four industry packs never appeared
        // in the picker at all, so their create/update tools were unreachable from the UI. It also
        // reported the Auto-mode tool count rather than what the agent actually offers.
        var agents = toolRegistry.GetAvailableModules()
            .Select(m => new AiAgentDto(m, AiAgents.Label(m), toolRegistry.GetTools(m).Count))
            .Where(a => a.ToolCount > 0)
            .OrderBy(a => a.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();

        Result<IReadOnlyList<AiAgentDto>> result = agents;
        return Task.FromResult(result);
    }
}
