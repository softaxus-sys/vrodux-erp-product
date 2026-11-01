using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>
/// Straight-line completion (no tools, no conversation) for other modules' batch work, such as the
/// SEO module's bulk issue analysis. Uses the same key resolution as the interactive assistant — the
/// workspace's own key first, the shared platform AI otherwise — so a workspace with no key of its
/// own can still use these features. Deliberately simpler than <c>AiOrchestrator.CallProviderAsync</c>
/// (no in-request retry): a background job can just try again on its next run.
/// </summary>
public sealed class AiCompletionService(IAiKeyResolver keys) : IAiCompletionService
{
    public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default)
    {
        var ai = await keys.ResolveAsync(countMessage: false, ct);
        var messages = new List<AiChatMessage> { new(AiRole.User, userPrompt) };
        var request  = new AiCompletionRequest(ai.Model, ai.ApiKey, systemPrompt, messages, []);
        var result   = await ai.Provider.CompleteAsync(request, ct);
        return result.AssistantText ?? "";
    }
}
