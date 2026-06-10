namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Issues and validates short-lived single-use challenge tokens for the public
/// trial-registration flow.  The secret never leaves the server; the client
/// receives only an opaque token whose validity is proven by HMAC-SHA256.
/// </summary>
public interface ITrialChallengeService
{
    /// <summary>
    /// Generate a new challenge token.  Tokens are valid for 10 minutes and
    /// can be consumed exactly once.
    /// </summary>
    string Generate();

    /// <summary>
    /// Validate and consume a token.  Returns <c>false</c> if the token is
    /// malformed, expired, signature-invalid, or has already been consumed.
    /// On <c>true</c> the token is immediately invalidated — replay is impossible.
    /// </summary>
    bool Consume(string? token);
}
