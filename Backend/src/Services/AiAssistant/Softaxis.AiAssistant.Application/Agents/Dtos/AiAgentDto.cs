namespace Softaxis.AiAssistant.Application.Agents.Dtos;

/// <summary>An agent the current user can talk to, with how many tools it exposes to them.</summary>
public sealed record AiAgentDto(string Key, string Label, int ToolCount);
