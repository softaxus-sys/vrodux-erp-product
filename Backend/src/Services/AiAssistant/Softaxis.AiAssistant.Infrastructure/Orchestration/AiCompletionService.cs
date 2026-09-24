using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// Straight-line completion (no tools, no conversation) using whatever provider/model the tenant has
/// configured — the same <c>TenantAiSettings</c> + <c>ISecretProtector</c> + <c>IAiProviderFactory</c>
/// <see cref="AiOrchestrator"/> uses, deliberately kept separate from its tool-calling loop (that's
/// built for one interactive change a human reviews; batch work like scanning 30 SEO issues needs one
/// structured completion per batch, not a multi-turn chat). Intentionally simpler than
/// <c>AiOrchestrator.CallProviderAsync</c> — no fallback-provider retry — since a background scan can
/// just try again on its next scheduled run rather than needing in-request resilience.
/// </summary>
public sealed class AiCompletionService(
    AiAssistantDbContext db,
    ISecretProtector protector,
    IAiProviderFactory providerFactory) : IAiCompletionService
{
    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default)
    {
        var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled)
            throw new AiNotConfiguredException("The AI assistant is not enabled for this workspace. Ask an administrator to enable it in Settings.");

        var apiKey = protector.Unprotect(settings.ProtectedApiKey);
        if (string.IsNullOrEmpty(apiKey))
            throw new AiNotConfiguredException("No AI provider API key is configured. Ask an administrator to add one in Settings.");

        var model = ResolveModel(settings.Provider, settings.Model)
            ?? throw new AiNotConfiguredException(
                "No model is set for your AI provider. OpenRouter's free-tier catalog changes often, " +
                "so pick a currently available model at openrouter.ai/models and paste its id into Settings.");

        var provider = providerFactory.Create(settings.Provider);
        var messages = new List<AiChatMessage> { new(AiRole.User, userPrompt) };
        var request  = new AiCompletionRequest(model, apiKey, systemPrompt, messages, []);
        var result   = await provider.CompleteAsync(request, ct);
        return result.AssistantText ?? "";
    }

    private static string? ResolveModel(AiProvider provider, string? configuredModel)
    {
        if (!string.IsNullOrWhiteSpace(configuredModel)) return configuredModel.Trim();
        return provider switch
        {
            AiProvider.Claude     => "claude-opus-4-8",
            AiProvider.OpenRouter => null,
            _                     => "openai/gpt-oss-120b",
        };
    }
}
