using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// The assistant engine. Loads the tenant's provider + decrypted key, assembles the caller-permitted
/// tools for the requested agent, and runs the model→tools→model loop until a final answer or a
/// pending write action. Tools execute as the current user, so tenant isolation and RBAC hold.
///
/// Every provider round-trip goes through <see cref="CallProviderAsync"/> — the one chokepoint that
/// retries against the tenant's optional BYO fallback provider (see <see cref="TenantAiSettings"/>)
/// when the primary fails in a retryable way (rate limited or having a bad time). This is why every
/// caller — interactive chat, confirm, and autonomous automation runs — gets the same resilience
/// without duplicating retry logic per call site.
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

    private sealed record ResolvedSettings(
        IAiChatProvider Provider, string Model, string ApiKey, AiProvider ProviderKind,
        IAiChatProvider? FallbackProvider, string? FallbackModel, string? FallbackApiKey, AiProvider? FallbackProviderKind);

    private readonly record struct ProviderCallResult(
        AiCompletionResult Result, bool UsedFallback, AiProvider AnsweredBy, string AnsweredModel);

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
        var usedFallback = false;

        for (var iteration = 0; iteration < MaxToolIterations; iteration++)
        {
            var call = await CallProviderAsync(settings, systemPrompt, messages, toolDefs, ct);
            usedFallback |= call.UsedFallback;
            var result = call.Result;

            if (!result.WantsTools)
            {
                var reply = result.AssistantText ?? "I wasn't able to produce a response. Please try rephrasing.";
                return Response(reply, toolsUsed, call.AnsweredBy, call.AnsweredModel, usedFallback, null, resolvedAgent);
            }

            // Execute read tools; the first WRITE tool stops the loop and becomes a pending action.
            messages.Add(new AiChatMessage(AiRole.Assistant, result.AssistantText, result.ToolCalls));

            foreach (var toolCall in result.ToolCalls)
            {
                var tool = toolRegistry.Resolve(toolCall.Name);

                if (tool is not null && !tool.IsReadOnly)
                {
                    var summary = string.IsNullOrWhiteSpace(result.AssistantText)
                        ? $"Run {toolCall.Name}."
                        : result.AssistantText!;
                    var pending = new PendingActionDto(toolCall.Id, toolCall.Name, toolCall.ArgumentsJson, summary);
                    var reply = string.IsNullOrWhiteSpace(result.AssistantText)
                        ? "I'd like to make a change on your behalf. Please confirm to proceed."
                        : result.AssistantText!;
                    return Response(reply, toolsUsed, call.AnsweredBy, call.AnsweredModel, usedFallback, pending, resolvedAgent);
                }

                var toolResult = await ExecuteReadToolAsync(tool, toolCall, ct);
                if (!toolsUsed.Contains(toolCall.Name)) toolsUsed.Add(toolCall.Name);
                messages.Add(new AiChatMessage(AiRole.Tool, toolResult, ToolCallId: toolCall.Id));
            }
        }

        // Loop budget exhausted — one final call with no tools to force a text answer.
        var finalCall = await CallProviderAsync(settings, systemPrompt, messages, [], ct);
        usedFallback |= finalCall.UsedFallback;
        var finalReply = finalCall.Result.AssistantText ?? "I gathered some data but couldn't finish the answer. Please try again.";
        return Response(finalReply, toolsUsed, finalCall.AnsweredBy, finalCall.AnsweredModel, usedFallback, null, resolvedAgent);
    }

    public async Task<AiChatResponseDto> ConfirmAsync(string toolName, string argumentsJson, CancellationToken ct)
    {
        var settings = await ResolveSettingsAsync(ct);

        var tool = toolRegistry.Resolve(toolName);
        if (tool is null)
            return Response($"That action ('{toolName}') is no longer available or you lack permission to run it.",
                [], settings.ProviderKind, settings.Model, false, null, null);

        string toolResult;
        try
        {
            using var argsDoc = ParseArgs(argumentsJson);
            toolResult = await tool.ExecuteAsync(argsDoc.RootElement, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI confirmed tool {Tool} failed", toolName);
            return Response($"The action failed to run: {ex.Message}", [], settings.ProviderKind, settings.Model, false, null, null);
        }

        // Summarise the outcome for the user (no tools — just a short confirmation).
        var systemPrompt = AiSystemPrompt.Build(tool.Agent, currentUser, false);
        var messages = new List<AiChatMessage>
        {
            new(AiRole.User,
                $"I confirmed the action '{toolName}'. Here is the result returned by the system:\n{toolResult}\n\n" +
                "In one or two sentences, confirm to me what was done (or explain the error if it failed). Do not invent details."),
        };
        var call = await CallProviderAsync(settings, systemPrompt, messages, [], ct);
        var reply = call.Result.AssistantText ?? "Done.";
        return Response(reply, [toolName], call.AnsweredBy, call.AnsweredModel, call.UsedFallback, null, tool.Agent);
    }

    public async Task<AiAutonomousResult> RunAutonomousAsync(
        string instruction, string? agent, bool autopilot, CancellationToken ct)
    {
        ResolvedSettings settings;
        try { settings = await ResolveSettingsAsync(ct); }
        catch (AiNotConfiguredException ex)
        {
            return new AiAutonomousResult("failed", "", [], null, ex.Message);
        }

        var resolvedAgent = string.IsNullOrWhiteSpace(agent) ? null : agent.Trim().ToLowerInvariant();
        var tools = toolRegistry.GetTools(resolvedAgent);
        var toolDefs = tools
            .Select(t => new AiToolDefinition(t.Name, t.Description, t.ParametersJsonSchema, t.IsReadOnly))
            .ToList();

        var systemPrompt = AiSystemPrompt.Build(resolvedAgent, currentUser, toolDefs.Count > 0)
            + "\n\nYou are running as a scheduled automation — there is NO human reading this in real time. "
            + "Be concise and factual, and base every statement strictly on tool results; never invent data. "
            + (autopilot
                ? "You may perform write actions directly when the task clearly requires them."
                : "Do not assume writes are pre-approved: if the task needs a change, call the single most appropriate write tool and stop — a human will approve it.");

        var messages = new List<AiChatMessage> { new(AiRole.User, instruction) };
        var toolsUsed = new List<string>();
        var usedFallback = false;

        for (var iteration = 0; iteration < MaxToolIterations; iteration++)
        {
            ProviderCallResult call;
            try { call = await CallProviderAsync(settings, systemPrompt, messages, toolDefs, ct); }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Autonomous run: provider call failed");
                return new AiAutonomousResult("failed", "", toolsUsed, null, ex.Message);
            }
            usedFallback |= call.UsedFallback;
            var result = call.Result;

            if (!result.WantsTools)
                return new AiAutonomousResult("success", result.AssistantText ?? "(no output)", toolsUsed, null, null, usedFallback);

            messages.Add(new AiChatMessage(AiRole.Assistant, result.AssistantText, result.ToolCalls));

            foreach (var toolCall in result.ToolCalls)
            {
                var tool = toolRegistry.Resolve(toolCall.Name);

                if (tool is not null && !tool.IsReadOnly && !autopilot)
                {
                    // Confirm mode: stop at the first write and queue it for approval.
                    var summary = string.IsNullOrWhiteSpace(result.AssistantText)
                        ? $"This automation wants to run '{toolCall.Name}'."
                        : result.AssistantText!;
                    var pending = new PendingActionDto(toolCall.Id, toolCall.Name, toolCall.ArgumentsJson, summary);
                    return new AiAutonomousResult("pending_confirmation", summary, toolsUsed, pending, null, usedFallback);
                }

                // Read tool, or a write tool in autopilot mode — execute and feed the result back.
                var toolResult = await ExecuteReadToolAsync(tool, toolCall, ct);
                if (!toolsUsed.Contains(toolCall.Name)) toolsUsed.Add(toolCall.Name);
                messages.Add(new AiChatMessage(AiRole.Tool, toolResult, ToolCallId: toolCall.Id));
            }
        }

        // Loop budget exhausted — one final call with no tools to force a text answer.
        try
        {
            var finalCall = await CallProviderAsync(settings, systemPrompt, messages, [], ct);
            usedFallback |= finalCall.UsedFallback;
            return new AiAutonomousResult("success", finalCall.Result.AssistantText ?? "(no output)", toolsUsed, null, null, usedFallback);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Autonomous run: final provider call failed");
            return new AiAutonomousResult("failed", "", toolsUsed, null, ex.Message);
        }
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
        var model    = ResolveModel(settings.Provider, settings.Model)
                        ?? throw new AiNotConfiguredException(
                            "No model is set for your AI provider. OpenRouter's free-tier catalog changes " +
                            "often, so there's no safe default — pick a currently available model at " +
                            "openrouter.ai/models and paste its id into Settings.");

        // Fallback is optional and BYO — never blocks the primary, silently unavailable if not
        // fully configured (provider chosen but no key stored, key fails to decrypt, or — for
        // OpenRouter — no model set, since guessing one here would be just as unsafe as above).
        IAiChatProvider? fallbackProvider = null;
        string? fallbackModel = null;
        string? fallbackApiKey = null;
        if (settings.FallbackConfigured)
        {
            var fbKey   = protector.Unprotect(settings.FallbackProtectedApiKey);
            var fbModel = ResolveModel(settings.FallbackProvider!.Value, settings.FallbackModel);
            if (!string.IsNullOrEmpty(fbKey) && fbModel is not null)
            {
                fallbackProvider = providerFactory.Create(settings.FallbackProvider!.Value);
                fallbackModel    = fbModel;
                fallbackApiKey   = fbKey;
            }
        }

        return new ResolvedSettings(
            provider, model, apiKey, settings.Provider,
            fallbackProvider, fallbackModel, fallbackApiKey,
            fallbackProvider is not null ? settings.FallbackProvider : null);
    }

    /// <summary>
    /// The one chokepoint every provider round-trip goes through. Tries the primary; on a
    /// retryable failure (rate limited or the provider having a bad time) with a fallback
    /// configured, retries once against the fallback. A non-retryable failure (bad key, bad
    /// request) is never retried — it would fail identically on the fallback and just hides a
    /// real misconfiguration.
    /// </summary>
    private async Task<ProviderCallResult> CallProviderAsync(
        ResolvedSettings settings, string systemPrompt, IReadOnlyList<AiChatMessage> messages,
        IReadOnlyList<AiToolDefinition> toolDefs, CancellationToken ct)
    {
        var primaryRequest = new AiCompletionRequest(settings.Model, settings.ApiKey, systemPrompt, messages, toolDefs);
        try
        {
            var result = await settings.Provider.CompleteAsync(primaryRequest, ct);
            return new ProviderCallResult(result, false, settings.ProviderKind, settings.Model);
        }
        catch (Exception ex) when (settings.FallbackProvider is not null && !ct.IsCancellationRequested && IsRetryable(ex))
        {
            logger.LogWarning(ex, "Primary AI provider {Provider} failed — retrying via fallback {Fallback}",
                settings.ProviderKind, settings.FallbackProviderKind);
            var fallbackRequest = new AiCompletionRequest(settings.FallbackModel!, settings.FallbackApiKey!, systemPrompt, messages, toolDefs);
            var result = await settings.FallbackProvider.CompleteAsync(fallbackRequest, ct);
            return new ProviderCallResult(result, true, settings.FallbackProviderKind!.Value, settings.FallbackModel!);
        }
    }

    private static bool IsRetryable(Exception ex) => ex switch
    {
        AiProviderException ape => ape.IsRetryable,
        HttpRequestException    => true,
        TaskCanceledException   => true, // the HTTP client's own timeout, not caller cancellation (excluded above)
        _                       => false,
    };

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
        string reply, IReadOnlyList<string> toolsUsed, AiProvider provider, string model, bool usedFallback,
        PendingActionDto? pending, string? agent) =>
        new(reply, toolsUsed, provider.ToString(), model, pending, agent, usedFallback);

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

    /// <summary>
    /// Resolves the model to use, or null if none is configured and none can be safely assumed.
    /// OpenRouter deliberately has NO hardcoded default: its free-tier catalog rotates model
    /// availability often enough (confirmed live — three different hardcoded ":free" slugs each
    /// 404'd within the same day as models were pulled from free tier) that guessing one is not a
    /// safe default, only a ticking time bomb. The tenant must pick a currently-live model
    /// themselves (openrouter.ai/models) — same principle as any other BYO credential.
    /// </summary>
    private static string? ResolveModel(AiProvider provider, string? configuredModel)
    {
        if (!string.IsNullOrWhiteSpace(configuredModel)) return configuredModel.Trim();
        return provider switch
        {
            AiProvider.Claude     => "claude-opus-4-8",
            AiProvider.OpenRouter => null,
            _                     => "openai/gpt-oss-120b", // Groq: llama-3.3-70b-versatile is deprecating (Aug 2026)
        };
    }
}
