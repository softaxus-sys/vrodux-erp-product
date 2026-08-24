namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>Raised when an upstream AI provider returns an error (bad key, rate limit, etc.).</summary>
public sealed class AiProviderException(string message, int? httpStatusCode = null) : Exception(message)
{
    public int? HttpStatusCode { get; } = httpStatusCode;

    /// <summary>
    /// True for failures worth retrying against a fallback provider — rate limited (429) or the
    /// provider having a bad time (5xx). False for anything else (bad key, bad request, etc.) —
    /// those would fail identically on a fallback, so retrying would just hide a real problem.
    /// </summary>
    public bool IsRetryable => HttpStatusCode is 429 or >= 500;
}
