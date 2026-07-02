using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// A pluggable AI back-end (Claude, Groq, …). One round-trip: given the system prompt,
/// conversation, and available tools, return either assistant text or tool calls to run.
/// Implementations are stateless and receive the tenant's API key per request (BYO-key).
/// </summary>
public interface IAiChatProvider
{
    AiProvider Provider { get; }
    Task<AiCompletionResult> CompleteAsync(AiCompletionRequest request, CancellationToken ct);
}

/// <summary>Resolves the concrete provider for a tenant's chosen <see cref="AiProvider"/>.</summary>
public interface IAiProviderFactory
{
    IAiChatProvider Create(AiProvider provider);
}
