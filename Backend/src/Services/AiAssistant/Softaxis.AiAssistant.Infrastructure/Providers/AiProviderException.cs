namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>Raised when an upstream AI provider returns an error (bad key, rate limit, etc.).</summary>
public sealed class AiProviderException(string message) : Exception(message);
