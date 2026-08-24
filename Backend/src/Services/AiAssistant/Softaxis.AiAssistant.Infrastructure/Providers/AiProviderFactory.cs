using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>Selects the concrete <see cref="IAiChatProvider"/> for a tenant's chosen provider.</summary>
public sealed class AiProviderFactory(IHttpClientFactory httpClientFactory) : IAiProviderFactory
{
    public IAiChatProvider Create(AiProvider provider) => provider switch
    {
        AiProvider.Claude   => new ClaudeChatProvider(httpClientFactory),
        AiProvider.GroqFree => new GroqChatProvider(httpClientFactory, AiProvider.GroqFree),
        AiProvider.GroqPaid => new GroqChatProvider(httpClientFactory, AiProvider.GroqPaid),
        AiProvider.OpenRouter => new OpenRouterChatProvider(httpClientFactory),
        _                   => throw new ArgumentOutOfRangeException(nameof(provider), provider, "Unknown AI provider."),
    };
}
