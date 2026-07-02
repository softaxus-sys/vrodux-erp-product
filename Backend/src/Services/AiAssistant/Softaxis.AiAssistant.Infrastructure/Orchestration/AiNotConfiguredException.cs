namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>Thrown when the tenant has not enabled/configured the AI assistant (no provider key).</summary>
public sealed class AiNotConfiguredException(string message) : Exception(message);
