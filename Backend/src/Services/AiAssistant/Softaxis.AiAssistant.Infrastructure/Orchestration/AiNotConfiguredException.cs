namespace Softaxis.AiAssistant.Infrastructure.Orchestration;

/// <summary>Thrown when the tenant has not enabled/configured the AI assistant (no provider key).</summary>
public class AiNotConfiguredException(string message) : Exception(message);

/// <summary>
/// The workspace is on the shared platform AI and has used its monthly allowance. A subclass so every
/// existing "not configured" catch already turns it into a friendly chat message.
/// </summary>
public sealed class AiPlatformLimitException(string message) : AiNotConfiguredException(message);
