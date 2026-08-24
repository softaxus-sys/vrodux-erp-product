namespace Softaxis.AiAssistant.Domain.Enums;

/// <summary>
/// The AI back-end a tenant has chosen. Tenants bring their own API key for whichever
/// provider they select (BYO-key). Groq (OpenAI-compatible) has a free and paid tier;
/// both use the same wire protocol and differ only by the key/model the tenant supplies.
/// </summary>
public enum AiProvider
{
    /// <summary>Anthropic Claude — Messages API (recommended default, highest tool-calling reliability).</summary>
    Claude = 0,

    /// <summary>Groq free tier — OpenAI-compatible endpoint, open models (Llama/Qwen/…). For evaluation.</summary>
    GroqFree = 1,

    /// <summary>Groq paid tier — same OpenAI-compatible endpoint, higher limits / production use.</summary>
    GroqPaid = 2,

    /// <summary>
    /// OpenRouter — OpenAI-compatible aggregator over many upstream providers/models behind one
    /// BYO key. Usable as a primary provider or, most usefully, as the fallback slot: its own
    /// per-request model-fallback list gives a second layer of resilience for one extra key.
    /// </summary>
    OpenRouter = 3,
}
