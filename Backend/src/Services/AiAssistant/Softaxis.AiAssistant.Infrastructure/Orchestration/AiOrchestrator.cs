using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// The assistant engine. Loads the tenant's provider + decrypted key, assembles the caller-permitted
/// tools for the requested agent, and runs the model→tools→model loop until a final answer or a
/// pending write action. Tools execute as the current user, so tenant isolation and RBAC hold.
/// </summary>
public sealed class AiOrchestrator(
    AiAssistantDbContext db,
    ISecretProtector protector,
    IAiProviderFactory providerFactory,
    IAiToolRegistry toolRegistry,
    ICurrentUser currentUser,
    ILogger<AiOrchestrator> logger) : IAiOrchestrator
{
    private const int MaxToolIterations = 6;

    private sealed record ResolvedSettings(IAiChatProvider Provider, string Model, string ApiKey, AiProvider ProviderKind);

    public async Task<AiChatResponseDto> RunAsync(
        string message,
        IReadOnlyList<AiChatMessage> history,
        string? agent,
        CancellationToken ct)
    {
        var settings = await ResolveSettingsAsync(ct);

        // Call-by-name: if no agent was supplied, detect a leading "Vrodux <agent>" and scope to it.
        var resolvedAgent = string.IsNullOrWhiteSpace(agent)
            ? DetectAgent(ref message)
            : agent.Trim().ToLowerInvariant();

        var tools = toolRegistry.GetTools(resolvedAgent);
        var toolDefs = tools
            .Select(t => new AiToolDefinition(t.Name, t.Description, t.ParametersJsonSchema, t.IsReadOnly))
            .ToList();

        var systemPrompt = AiSystemPrompt.Build(resolvedAgent, currentUser, toolDefs.Count > 0);
        var messages = new List<AiChatMessage>(history) { new(AiRole.User, message) };
        var toolsUsed = new List<string>();

        for (var iteration = 0; iteration < MaxToolIterations; iteration++)
        {
            var request = new AiCompletionRequest(settings.Model, settings.ApiKey, systemPrompt, messages, toolDefs);
            var result  = await settings.Provider.CompleteAsync(request, ct);

            if (!result.WantsTools)
            {
                var reply = result.AssistantText ?? "I wasn't able to produce a response. Please try rephrasing.";
                return Response(reply, toolsUsed, settings, null, resolvedAgent);
            }

            // Execute read tools; the first WRITE tool stops the loop and becomes a pending action.
            messages.Add(new AiChatMessage(AiRole.Assistant, result.AssistantText, result.ToolCalls));

            foreach (var call in result.ToolCalls)
            {
                var tool = toolRegistry.Resolve(call.Name);

                if (tool is not null && !tool.IsReadOnly)
                {
                    var summary = string.IsNullOrWhiteSpace(result.AssistantText)
                        ? $"Run {call.Name}."
                        : result.AssistantText!;
                    var pending = new PendingActionDto(call.Id, call.Name, call.ArgumentsJson, summary);
                    var reply = string.IsNullOrWhiteSpace(result.AssistantText)
                        ? "I'd like to make a change on your behalf. Please confirm to proceed."
                        : result.AssistantText!;
                    return Response(reply, toolsUsed, settings, pending, resolvedAgent);
                }

                var toolResult = await ExecuteReadToolAsync(tool, call, ct);
                if (!toolsUsed.Contains(call.Name)) toolsUsed.Add(call.Name);
                messages.Add(new AiChatMessage(AiRole.Tool, toolResult, ToolCallId: call.Id));
            }
        }

        // Loop budget exhausted — one final call with no tools to force a text answer.
        var finalRequest = new AiCompletionRequest(settings.Model, settings.ApiKey, systemPrompt, messages, []);
        var finalResult  = await settings.Provider.CompleteAsync(finalRequest, ct);
        var finalReply   = finalResult.AssistantText ?? "I gathered some data but couldn't finish the answer. Please try again.";
        return Response(finalReply, toolsUsed, settings, null, resolvedAgent);
    }

    public async Task<AiChatResponseDto> ConfirmAsync(string toolName, string argumentsJson, CancellationToken ct)
    {
        var settings = await ResolveSettingsAsync(ct);

        var tool = toolRegistry.Resolve(toolName);
        if (tool is null)
            return Response($"That action ('{toolName}') is no longer available or you lack permission to run it.", [], settings, null, null);

        string toolResult;
        try
        {
            using var argsDoc = ParseArgs(argumentsJson);
            toolResult = await tool.ExecuteAsync(argsDoc.RootElement, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI confirmed tool {Tool} failed", toolName);
            return Response($"The action failed to run: {ex.Message}", [], settings, null, null);
        }

        // Summarise the outcome for the user (no tools — just a short confirmation).
        var systemPrompt = AiSystemPrompt.Build(tool.Agent, currentUser, false);
        var messages = new List<AiChatMessage>
        {
            new(AiRole.User,
                $"I confirmed the action '{toolName}'. Here is the result returned by the system:\n{toolResult}\n\n" +
                "In one or two sentences, confirm to me what was done (or explain the error if it failed). Do not invent details."),
        };
        var request = new AiCompletionRequest(settings.Model, settings.ApiKey, systemPrompt, messages, []);
        var result  = await settings.Provider.CompleteAsync(request, ct);
        var reply   = result.AssistantText ?? "Done.";
        return Response(reply, [toolName], settings, null, tool.Agent);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<ResolvedSettings> ResolveSettingsAsync(CancellationToken ct)
    {
        var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled)
            throw new AiNotConfiguredException("The AI assistant is not enabled for your company. Ask an administrator to enable it in Settings.");

        var apiKey = protector.Unprotect(settings.ProtectedApiKey);
        if (string.IsNullOrEmpty(apiKey))
            throw new AiNotConfiguredException("No AI provider API key is configured. Ask an administrator to add one in Settings.");

        var provider = providerFactory.Create(settings.Provider);
        var model    = string.IsNullOrWhiteSpace(settings.Model) ? DefaultModel(settings.Provider) : settings.Model!;
        return new ResolvedSettings(provider, model, apiKey, settings.Provider);
    }

    private async Task<string> ExecuteReadToolAsync(IAiTool? tool, AiToolCall call, CancellationToken ct)
    {
        if (tool is null)
            return $"{{\"error\":\"Tool '{call.Name}' is not available or you lack permission to use it.\"}}";
        try
        {
            using var argsDoc = ParseArgs(call.ArgumentsJson);
            return await tool.ExecuteAsync(argsDoc.RootElement, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI tool {Tool} failed", call.Name);
            return $"{{\"error\":\"The tool failed to run: {ex.Message}\"}}";
        }
    }

    private static AiChatResponseDto Response(
        string reply, IReadOnlyList<string> toolsUsed, ResolvedSettings s, PendingActionDto? pending, string? agent) =>
        new(reply, toolsUsed, s.ProviderKind.ToString(), s.Model, pending, agent);

    /// <summary>Detects a leading "Vrodux &lt;agent&gt;" / "&lt;agent&gt; agent" and strips it from the message.</summary>
    private static string? DetectAgent(ref string message)
    {
        var trimmed = message.TrimStart();
        foreach (var (key, label) in AiAgents.Labels)
        {
            // Match "vrodux crm", "crm agent", or a leading "crm:" / "crm,"
            foreach (var token in new[] { $"vrodux {key}", $"{key} agent", $"{key}:", $"{key} -" })
            {
                if (trimmed.StartsWith(token, StringComparison.OrdinalIgnoreCase))
                {
                    message = trimmed[token.Length..].TrimStart(' ', ',', ':', '-');
                    return key;
                }
            }
            // Also match the display label, e.g. "vrodux finance"
            if (trimmed.StartsWith($"vrodux {label}", StringComparison.OrdinalIgnoreCase))
            {
                message = trimmed[($"vrodux {label}").Length..].TrimStart(' ', ',', ':', '-');
                return key;
            }
        }
        return null;
    }

    private static JsonDocument ParseArgs(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return JsonDocument.Parse("{}");
        try { return JsonDocument.Parse(json); }
        catch { return JsonDocument.Parse("{}"); }
    }

    private static string DefaultModel(AiProvider provider) => provider switch
    {
        AiProvider.Claude => "claude-opus-4-8",
        _                 => "llama-3.3-70b-versatile",
    };
}
