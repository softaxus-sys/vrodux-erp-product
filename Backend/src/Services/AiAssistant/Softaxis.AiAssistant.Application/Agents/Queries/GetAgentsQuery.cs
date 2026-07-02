using Softaxis.AiAssistant.Application.Agents.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Agents.Queries;

/// <summary>Lists the agents the current user can use (those with at least one permitted tool).</summary>
public sealed record GetAgentsQuery : IQuery<IReadOnlyList<AiAgentDto>>;
