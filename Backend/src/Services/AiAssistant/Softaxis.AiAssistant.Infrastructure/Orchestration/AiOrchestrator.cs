using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// The assistant engine. Loads the tenant's provider + decrypted key, assembles the caller-permitted
/// tools for the requested agent, and runs the model→tools→model loop until a final answer. Tools
/// execute as the current user, so tenant isolation and RBAC hold throughout.
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

    public async Task<AiChatResponseDto> RunAsync(
        string message,
        IReadOnlyList<AiChatMessage> history,
        string? agent,
        CancellationToken ct)
    {
        var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled)
            throw new AiNotConfiguredException("The AI assistant is not enabled for your company. Ask an administrator to enable it in Settings.");

        var apiKey = protector.Unprotect(settings.ProtectedApiKey);
        if (string.IsNullOrEmpty(apiKey))
            throw new AiNotConfiguredException("No AI provider API key is configured. Ask an administrator to add one in Settings.");

        var provider = providerFactory.Create(settings.Provider);
        var model    = string.IsNullOrWhiteSpace(settings.Model) ? DefaultModel(settings.Provider) : settings.Model!;

        var tools = toolRegistry.GetTools(agent);
        var toolDefs = tools
            .Select(t => new AiToolDefinition(t.Name, t.Description, t.ParametersJsonSchema, t.IsReadOnly))
            .ToList();

        var systemPrompt = AiSystemPrompt.Build(agent, currentUser, toolDefs.Count > 0);

        // Build the running conversation: prior history + the new user turn.
        var messages = new List<AiChatMessage>(history) { new(AiRole.User, message) };

        var toolsUsed = new List<string>();

        for (var iteration = 0; iteration < MaxToolIterations; iteration++)
        {
            var request = new AiCompletionRequest(model, apiKey, systemPrompt, messages, toolDefs);
            var result  = await provider.CompleteAsync(request, ct);

            if (!result.WantsTools)
            {
                var reply = result.AssistantText ?? "I wasn't able to produce a response. Please try rephrasing.";
                return new AiChatResponseDto(reply, toolsUsed, settings.Provider.ToString(), model);
            }

            // Record the assistant's tool-call turn, then execute each tool and feed results back.
            messages.Add(new AiChatMessage(AiRole.Assistant, result.AssistantText, result.ToolCalls));

            foreach (var call in result.ToolCalls)
            {
                var toolResult = await ExecuteToolAsync(call, ct);
                if (!toolsUsed.Contains(call.Name)) toolsUsed.Add(call.Name);
                messages.Add(new AiChatMessage(AiRole.Tool, toolResult, ToolCallId: call.Id));
            }
        }

        // Loop budget exhausted — make one final call with no tools to force a text answer.
        var finalRequest = new AiCompletionRequest(model, apiKey, systemPrompt, messages, []);
        var finalResult  = await provider.CompleteAsync(finalRequest, ct);
        var finalReply   = finalResult.AssistantText ?? "I gathered some data but couldn't finish the answer. Please try again.";
        return new AiChatResponseDto(finalReply, toolsUsed, settings.Provider.ToString(), model);
    }

    private async Task<string> ExecuteToolAsync(AiToolCall call, CancellationToken ct)
    {
        var tool = toolRegistry.Resolve(call.Name);
        if (tool is null)
            return $"{{\"error\":\"Tool '{call.Name}' is not available or you lack permission to use it.\"}}";

        // Milestone 1 ships read-only tools only. Mutating tools are gated until the
        // confirmation flow lands (Milestone 2) — never auto-execute a write.
        if (!tool.IsReadOnly)
            return "{\"error\":\"This action changes data and requires explicit confirmation, which isn't supported yet.\"}";

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

    private static JsonDocument ParseArgs(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return JsonDocument.Parse("{}");
        try { return JsonDocument.Parse(json); }
        catch { return JsonDocument.Parse("{}"); }
    }

    private static string DefaultModel(AiProvider provider) => provider switch
    {
        AiProvider.Claude => "claude-opus-4-8",
        _                 => "llama-3.3-70b-versatile", // Groq free + paid default
    };
}
