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
        var agents = toolRegistry.GetTools(null)
            .GroupBy(t => t.Agent, StringComparer.OrdinalIgnoreCase)
            .Select(g => new AiAgentDto(g.Key, AiAgents.Label(g.Key), g.Count()))
            .OrderBy(a => a.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();

        Result<IReadOnlyList<AiAgentDto>> result = agents;
        return Task.FromResult(result);
    }
}
