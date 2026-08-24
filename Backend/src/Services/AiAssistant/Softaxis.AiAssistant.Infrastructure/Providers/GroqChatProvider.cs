using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// Groq provider — OpenAI-compatible Chat Completions endpoint (open models: Llama, Qwen, …).
/// The free and paid tiers share this implementation; they differ only by the tenant's key/model.
/// </summary>
public sealed class GroqChatProvider(IHttpClientFactory httpClientFactory, AiProvider provider)
    : OpenAiCompatibleChatProvider(httpClientFactory)
{
    protected override string Endpoint => "https://api.groq.com/openai/v1/chat/completions";
    public override AiProvider Provider { get; } = provider; // GroqFree or GroqPaid
}
