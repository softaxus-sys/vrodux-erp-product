using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>Builds the system prompt for a turn — the assistant persona, guardrails, and caller context.</summary>
internal static class AiSystemPrompt
{
    public static string Build(string? agent, ICurrentUser user, bool hasTools)
    {
        var who = string.IsNullOrWhiteSpace(agent) ? "Vrodux Assistant" : $"Vrodux {agent.ToUpperInvariant()} agent";
        var name = user.Username ?? user.Email ?? "the user";

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"You are {who}, an AI assistant embedded in the Vrodux ERP system.");
        sb.AppendLine($"You are helping {name}. Answer questions about their company's business data clearly and concisely.");
        sb.AppendLine();
        sb.AppendLine("Rules:");
        sb.AppendLine("- Only use information returned by your tools. Do not invent numbers, names, or records.");
        sb.AppendLine("- All tools already operate on the current company's data only and respect the user's permissions; you never need to ask which company.");
        sb.AppendLine("- If a tool returns an error or no data, say so plainly rather than guessing.");
        sb.AppendLine("- Format lists and figures in clean Markdown (tables where helpful). Keep answers focused.");
        sb.AppendLine("- Currency is AED unless the data says otherwise.");
        if (hasTools)
            sb.AppendLine("- When a question needs live data, call the appropriate tool before answering.");
        else
            sb.AppendLine("- You currently have no data tools available; answer from the conversation only and suggest the user enable the relevant module.");

        return sb.ToString();
    }
}
