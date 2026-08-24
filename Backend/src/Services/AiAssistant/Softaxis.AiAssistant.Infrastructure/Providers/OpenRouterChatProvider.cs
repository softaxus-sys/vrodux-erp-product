using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// OpenRouter provider — OpenAI-compatible Chat Completions endpoint that proxies to many
/// upstream providers/models behind one BYO key. Model strings are provider-prefixed, e.g.
/// "meta-llama/llama-3.3-70b-instruct" or "anthropic/claude-sonnet-4.5" — free-tier models carry
/// a ":free" suffix.
/// </summary>
public sealed class OpenRouterChatProvider(IHttpClientFactory httpClientFactory)
    : OpenAiCompatibleChatProvider(httpClientFactory)
{
    protected override string Endpoint => "https://openrouter.ai/api/v1/chat/completions";
    public override AiProvider Provider => AiProvider.OpenRouter;
}
